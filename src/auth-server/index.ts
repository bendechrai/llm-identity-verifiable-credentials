/**
 * Authorization Server
 *
 * The TRUST BOUNDARY between the LLM and protected resources.
 * - Generates cryptographic nonces (challenges)
 * - Verifies Verifiable Presentations
 * - Derives scopes from verified credentials (SERVER-SIDE - client cannot inflate)
 * - Issues short-lived JWTs (60 seconds)
 *
 * Port: 3003
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';
import {
  createApp,
  startServer,
  loadOrCreateKeyPair,
  keyPairToDid,
  verifyPresentation,
  signJwt,
  createJwks,
  createAuditLogger,
  createHttpClient,
  type KeyPair,
  type VerifiablePresentation,
  type VerifiableCredential,
  type JwtPayload,
  type PresentationRequest,
  type TokenResponse,
} from '../lib/index.js';

const PORT = parseInt(process.env.PORT || '3003', 10);
const KEY_PATH = process.env.KEY_PATH || '/app/keys/auth-key.json';
const ISSUER_URL = process.env.ISSUER_URL || 'http://vc-issuer:3001';
const TOKEN_EXPIRY_SECONDS = parseInt(process.env.TOKEN_EXPIRY_SECONDS || '60', 10);
const NONCE_TTL_SECONDS = 300; // 5 minutes

// Auth server key pair
let authKeyPair: KeyPair;
let authDid: string;

// Trusted issuers (populated on startup)
const trustedIssuers = new Set<string>();

// Nonce management (single-use nonces)
interface NonceEntry {
  nonce: string;
  domain: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}
const nonceStore = new Map<string, NonceEntry>();

// Audit logger
const auditLogger = createAuditLogger();

// ============================================================
// Nonce Management
// ============================================================

/**
 * Generate a cryptographically random nonce (144 bits = 18 bytes)
 */
function generateNonce(): string {
  return crypto.randomBytes(18).toString('hex');
}

/**
 * Store a nonce with TTL
 */
function storeNonce(nonce: string, domain: string): NonceEntry {
  const now = Date.now();
  const entry: NonceEntry = {
    nonce,
    domain,
    createdAt: now,
    expiresAt: now + NONCE_TTL_SECONDS * 1000,
    used: false,
  };
  nonceStore.set(nonce, entry);
  return entry;
}

/**
 * Consume a nonce (single-use validation)
 * Returns the entry if valid, null if invalid/expired/used
 */
function consumeNonce(nonce: string, expectedDomain: string): NonceEntry | null {
  const entry = nonceStore.get(nonce);

  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    nonceStore.delete(nonce);
    return null;
  }

  // Check if already used
  if (entry.used) {
    return null;
  }

  // Check domain
  if (entry.domain !== expectedDomain) {
    return null;
  }

  // Mark as used (single-use)
  entry.used = true;

  return entry;
}

/**
 * Clean up expired nonces
 */
function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [nonce, entry] of nonceStore) {
    if (now > entry.expiresAt) {
      nonceStore.delete(nonce);
    }
  }
}

// ============================================================
// Scope Derivation (SERVER-SIDE - THE SECURITY CORE)
// ============================================================

interface DerivedScopes {
  scopes: string[];
  claims: {
    employeeId?: string;
    name?: string;
    approvalLimit?: number;
  };
}

/**
 * Derive scopes from verified credentials.
 * This is SERVER-SIDE only - the client cannot inflate these values.
 */
function deriveScopesFromCredentials(credentials: VerifiableCredential[]): DerivedScopes {
  const scopes: string[] = [];
  const claims: DerivedScopes['claims'] = {};

  for (const credential of credentials) {
    const subject = credential.credentialSubject as Record<string, unknown>;

    if (credential.type.includes('EmployeeCredential')) {
      // Employee credentials grant view and submit
      scopes.push('expense:view', 'expense:submit');

      // Extract claims
      claims.employeeId = subject.employeeId as string;
      claims.name = subject.name as string;
    }

    if (credential.type.includes('FinanceApproverCredential')) {
      // Finance approver credentials grant approval up to limit
      const approvalLimit = subject.approvalLimit as number;
      if (typeof approvalLimit === 'number' && approvalLimit > 0) {
        // THE CRYPTOGRAPHIC CEILING - encoded in the scope
        scopes.push(`expense:approve:max:${approvalLimit}`);
        claims.approvalLimit = approvalLimit;
      }
    }
  }

  return { scopes: [...new Set(scopes)], claims };
}

// ============================================================
// Express Application
// ============================================================

async function main() {
  // Load or create auth server key pair
  authKeyPair = await loadOrCreateKeyPair(KEY_PATH);
  authDid = keyPairToDid(authKeyPair);

  console.log(`[Auth Server] Auth Server DID: ${authDid}`);

  // Fetch trusted issuers on startup
  try {
    const issuerClient = createHttpClient(ISSUER_URL);
    const issuerInfo = await issuerClient.get<{ did: string }>('/issuer/info');
    trustedIssuers.add(issuerInfo.did);
    console.log(`[Auth Server] Trusted issuer: ${issuerInfo.did}`);
  } catch (error) {
    console.warn('[Auth Server] Could not fetch issuer info, will retry on requests');
  }

  // Cleanup expired nonces periodically
  setInterval(cleanupExpiredNonces, 60000);

  const app = createApp('auth-server');

  // ============================================================
  // Endpoints
  // ============================================================

  /**
   * POST /auth/presentation-request
   * Generate a nonce and return credential requirements
   */
  app.post('/auth/presentation-request', (_req, res) => {
    // Generate nonce
    const nonce = generateNonce();
    const domain = 'expense-api'; // The intended audience

    // Store nonce
    storeNonce(nonce, domain);

    const presentationRequest: PresentationRequest = {
      challenge: nonce,
      domain,
      credentialsRequired: [
        {
          type: 'EmployeeCredential',
          purpose: 'Verify employment status',
        },
        {
          type: 'FinanceApproverCredential',
          purpose: 'Verify approval authority',
        },
      ],
    };

    console.log(`[Auth Server] Generated challenge: ${nonce}`);

    res.json({
      presentationRequest,
      expiresIn: NONCE_TTL_SECONDS,
    });
  });

  /**
   * POST /auth/token
   * Exchange a Verifiable Presentation for an access token
   *
   * This is THE CRITICAL ENDPOINT:
   * 1. Validate nonce (single-use)
   * 2. Verify VP signature
   * 3. Verify each credential signature
   * 4. Check issuer trust
   * 5. Derive scopes SERVER-SIDE
   * 6. Issue short-lived JWT
   */
  app.post('/auth/token', async (req, res, next) => {
    try {
      const { presentation, challenge, domain } = req.body as {
        presentation: VerifiablePresentation;
        challenge: string;
        domain: string;
      };

      // Step 1: Validate nonce
      const nonceEntry = consumeNonce(challenge, domain);
      if (!nonceEntry) {
        auditLogger.log('authorization_decision', {
          challenge,
          decision: 'denied',
          reason: 'Invalid, expired, or already used nonce',
        });

        res.status(401).json({
          error: 'invalid_nonce',
          message: 'Invalid, expired, or already used challenge',
        });
        return;
      }

      // Step 2: Verify VP signature (holder's signature)
      const vpResult = await verifyPresentation(presentation, challenge, domain);

      if (!vpResult.verified) {
        auditLogger.log('authorization_decision', {
          challenge,
          holderDid: presentation.holder,
          decision: 'denied',
          reason: 'VP verification failed',
          error: vpResult.error,
        });

        res.status(401).json({
          error: 'invalid_presentation',
          message: 'Verifiable Presentation verification failed',
          details: vpResult.error,
        });
        return;
      }

      // Step 3 & 4: Check each credential's issuer trust
      const credentials = presentation.verifiableCredential;
      const credentialResults: Array<{
        type: string[];
        issuer: string;
        trusted: boolean;
        verified: boolean;
      }> = [];

      for (let i = 0; i < credentials.length; i++) {
        const cred = credentials[i];
        const issuerTrusted = trustedIssuers.has(cred.issuer);

        // If issuer not trusted, try to fetch from issuer service
        if (!issuerTrusted) {
          try {
            const issuerClient = createHttpClient(ISSUER_URL);
            const issuerInfo = await issuerClient.get<{ did: string }>('/issuer/info');
            trustedIssuers.add(issuerInfo.did);
          } catch {
            // Issuer still not trusted
          }
        }

        const isTrusted = trustedIssuers.has(cred.issuer);
        const verified = vpResult.credentialResults[i]?.verified ?? false;

        credentialResults.push({
          type: cred.type,
          issuer: cred.issuer,
          trusted: isTrusted,
          verified,
        });

        if (!isTrusted) {
          auditLogger.log('authorization_decision', {
            challenge,
            holderDid: presentation.holder,
            decision: 'denied',
            reason: 'Untrusted issuer',
            issuer: cred.issuer,
          });

          res.status(401).json({
            error: 'untrusted_issuer',
            message: `Credential issuer not trusted: ${cred.issuer}`,
          });
          return;
        }
      }

      // Step 5: Derive scopes SERVER-SIDE (client cannot inflate)
      const { scopes, claims } = deriveScopesFromCredentials(credentials);

      // Step 6: Issue JWT
      const tokenId = uuidv4();
      const now = Math.floor(Date.now() / 1000);

      const jwtPayload: JwtPayload = {
        iss: authDid,
        sub: presentation.holder,
        aud: domain,
        exp: now + TOKEN_EXPIRY_SECONDS,
        iat: now,
        jti: tokenId,
        scope: scopes.join(' '),
        claims,
      };

      const token = await signJwt(jwtPayload, authKeyPair, `${authDid}#${authKeyPair.publicKeyMultibase}`);

      // Log success
      auditLogger.log('token_issued', {
        tokenId,
        challenge,
        holderDid: presentation.holder,
        scopes,
        claims,
        expiresAt: new Date((now + TOKEN_EXPIRY_SECONDS) * 1000).toISOString(),
        credentialResults,
      });

      const response: TokenResponse = {
        access_token: token,
        token_type: 'Bearer',
        expires_in: TOKEN_EXPIRY_SECONDS,
        scope: scopes.join(' '),
        claims: {
          employee: credentials.some((c) => c.type.includes('EmployeeCredential')),
          employeeId: claims.employeeId || '',
          name: claims.name || '',
          approvalLimit: claims.approvalLimit || 0,
          department: 'Finance',
        },
      };

      console.log(`[Auth Server] Issued token with scopes: ${scopes.join(' ')}`);

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /auth/jwks
   * Return public keys for token verification
   */
  app.get('/auth/jwks', async (req, res) => {
    const jwks = await createJwks(authKeyPair, `${authDid}#${authKeyPair.publicKeyMultibase}`);
    res.json(jwks);
  });

  /**
   * GET /auth/trusted-issuers
   * Return list of trusted issuers
   */
  app.get('/auth/trusted-issuers', (req, res) => {
    res.json({
      issuers: Array.from(trustedIssuers),
    });
  });

  /**
   * POST /demo/reset
   * Clear nonces and audit log for demo reset
   */
  app.post('/demo/reset', (req, res) => {
    nonceStore.clear();
    auditLogger.clear();
    console.log('[Auth Server] Demo reset - nonces and audit log cleared');

    res.json({
      message: 'Auth server reset complete',
    });
  });

  /**
   * GET /demo/audit-log
   * Return audit log entries
   */
  app.get('/demo/audit-log', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const entries = auditLogger.getRecent(limit);

    res.json({
      entries,
      count: entries.length,
    });
  });

  // Start server
  startServer(app, PORT, 'auth-server');
}

main().catch((error) => {
  console.error('[Auth Server] Failed to start:', error);
  process.exit(1);
});
