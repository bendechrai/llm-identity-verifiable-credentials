/**
 * VC Wallet Service
 *
 * Stores credentials and creates Verifiable Presentations.
 * The wallet holds the holder's private key - the LLM never has access to it.
 *
 * Port: 3002
 */

import { v4 as uuidv4 } from 'uuid';
import {
  createApp,
  startServer,
  loadOrCreateKeyPair,
  keyPairToDid,
  verifyCredential,
  createPresentation,
  signPresentation,
  createHttpClient,
  type KeyPair,
  type VerifiableCredential,
} from '../lib/index.js';

const PORT = parseInt(process.env.PORT || '3002', 10);
const KEY_PATH = process.env.KEY_PATH || '/app/keys/holder-key.json';
const ISSUER_URL = process.env.ISSUER_URL || 'http://vc-issuer:3001';

// Holder key pair (loaded on startup)
let holderKeyPair: KeyPair;
let holderDid: string;

// In-memory credential storage
const credentialStore = new Map<string, VerifiableCredential>();

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generate a unique credential ID
 */
function generateCredentialId(): string {
  return `urn:uuid:${uuidv4()}`;
}

/**
 * Get credential ID from a credential
 */
function getCredentialId(credential: VerifiableCredential): string {
  // If credential has an id, use it; otherwise generate one
  const cred = credential as { id?: string };
  return cred.id || generateCredentialId();
}

// ============================================================
// Express Application
// ============================================================

async function main() {
  // Load or create holder key pair
  holderKeyPair = await loadOrCreateKeyPair(KEY_PATH);
  holderDid = keyPairToDid(holderKeyPair);

  console.log(`[VC Wallet] Holder DID: ${holderDid}`);

  const app = createApp('vc-wallet');

  // ============================================================
  // Endpoints
  // ============================================================

  /**
   * POST /wallet/credentials
   * Store a new credential
   */
  app.post('/wallet/credentials', async (req, res, next) => {
    try {
      const credential = req.body as VerifiableCredential;

      // Verify the credential signature
      const verificationResult = await verifyCredential(credential);
      if (!verificationResult.verified) {
        res.status(400).json({
          error: 'invalid_credential',
          message: 'Credential signature verification failed',
          details: verificationResult.error,
        });
        return;
      }

      // Verify holder binding (credentialSubject.id must match holder DID)
      const subjectId = (credential.credentialSubject as { id?: string }).id;
      if (subjectId && subjectId !== holderDid) {
        res.status(400).json({
          error: 'holder_mismatch',
          message: 'Credential subject ID does not match wallet holder DID',
          expected: holderDid,
          received: subjectId,
        });
        return;
      }

      // Store the credential
      const credentialId = getCredentialId(credential);
      credentialStore.set(credentialId, credential);

      console.log(`[VC Wallet] Stored credential: ${credential.type.join(', ')}`);

      res.status(201).json({
        id: credentialId,
        stored: true,
        type: credential.type,
        message: 'Credential stored successfully',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /wallet/credentials
   * List all stored credentials
   */
  app.get('/wallet/credentials', (req, res) => {
    const credentials = Array.from(credentialStore.entries()).map(([id, cred]) => ({
      id,
      type: cred.type,
      issuer: cred.issuer,
      validFrom: cred.validFrom,
      validUntil: cred.validUntil,
    }));

    res.json({
      holder: holderDid,
      credentials,
    });
  });

  /**
   * GET /wallet/credentials/:id
   * Get a specific credential
   */
  app.get('/wallet/credentials/:id', (req, res) => {
    const credential = credentialStore.get(req.params.id);

    if (!credential) {
      res.status(404).json({
        error: 'not_found',
        message: 'Credential not found',
      });
      return;
    }

    res.json(credential);
  });

  /**
   * DELETE /wallet/credentials/:id
   * Remove a credential
   */
  app.delete('/wallet/credentials/:id', (req, res) => {
    const deleted = credentialStore.delete(req.params.id);

    if (!deleted) {
      res.status(404).json({
        error: 'not_found',
        message: 'Credential not found',
      });
      return;
    }

    res.json({
      message: 'Credential deleted',
    });
  });

  /**
   * POST /wallet/present
   * Create a Verifiable Presentation with challenge/domain binding
   *
   * This is the CRITICAL endpoint for security:
   * - Signs the presentation with the holder's private key
   * - Binds the presentation to a specific challenge (nonce) and domain
   * - This prevents replay attacks
   */
  app.post('/wallet/present', async (req, res, next) => {
    try {
      const { credentialTypes, challenge, domain } = req.body as {
        credentialTypes: string[];
        challenge: string;
        domain: string;
      };

      // Validate required fields
      if (!challenge || !domain) {
        res.status(400).json({
          error: 'validation_error',
          message: 'challenge and domain are required',
        });
        return;
      }

      // Find matching credentials
      const credentials: VerifiableCredential[] = [];
      const availableTypes = new Set<string>();

      for (const [, cred] of credentialStore) {
        cred.type.forEach((t) => availableTypes.add(t));

        if (!credentialTypes || credentialTypes.some((t) => cred.type.includes(t))) {
          credentials.push(cred);
        }
      }

      if (credentials.length === 0) {
        res.status(400).json({
          error: 'missing_credentials',
          message: 'No matching credentials found',
          requested: credentialTypes,
          available: Array.from(availableTypes),
        });
        return;
      }

      // Create unsigned presentation
      const unsignedPresentation = createPresentation(credentials, holderDid);

      // Sign with challenge and domain (authentication proof purpose)
      const signedPresentation = await signPresentation(
        unsignedPresentation,
        holderKeyPair,
        challenge,
        domain
      );

      console.log(`[VC Wallet] Created presentation with ${credentials.length} credential(s)`);
      console.log(`[VC Wallet] Challenge: ${challenge}, Domain: ${domain}`);

      res.json(signedPresentation);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /wallet/did
   * Return the holder's DID
   */
  app.get('/wallet/did', (req, res) => {
    res.json({
      did: holderDid,
    });
  });

  /**
   * POST /wallet/demo/setup
   * Demo initialization - fetch Alice's credentials from issuer
   */
  app.post('/wallet/demo/setup', async (req, res, next) => {
    try {
      // Clear existing credentials
      credentialStore.clear();
      console.log('[VC Wallet] Cleared existing credentials');

      // Call issuer to get Alice's credentials
      const issuerClient = createHttpClient(ISSUER_URL);

      const response = await issuerClient.post<{
        employeeCredential: VerifiableCredential;
        financeApproverCredential: VerifiableCredential;
        holderDid: string;
      }>('/demo/issue-alice-credentials', { holderDid });

      // Convert to array for easier processing
      const credentials = [response.employeeCredential, response.financeApproverCredential];

      // Verify and store the credentials
      for (const credential of credentials) {
        // Verify credential signature
        const verificationResult = await verifyCredential(credential);
        if (!verificationResult.verified) {
          console.error(`[VC Wallet] Failed to verify credential: ${credential.type.join(', ')}`);
          res.status(400).json({
            error: 'invalid_credential',
            message: `Demo setup failed: credential verification failed for ${credential.type.join(', ')}`,
            details: verificationResult.error,
          });
          return;
        }

        // Verify holder binding
        const subjectId = (credential.credentialSubject as { id?: string }).id;
        if (subjectId && subjectId !== holderDid) {
          console.error(`[VC Wallet] Holder mismatch for credential: ${credential.type.join(', ')}`);
          res.status(400).json({
            error: 'holder_mismatch',
            message: 'Demo setup failed: credential subject ID does not match wallet holder DID',
            expected: holderDid,
            received: subjectId,
          });
          return;
        }

        const credentialId = getCredentialId(credential);
        credentialStore.set(credentialId, credential);
        console.log(`[VC Wallet] Verified and stored credential: ${credential.type.join(', ')}`);
      }

      // Get approval limit from FinanceApproverCredential
      const approvalLimit = (response.financeApproverCredential.credentialSubject as { approvalLimit?: number }).approvalLimit;

      res.json({
        holder: holderDid,
        credentials: credentials.map((c) => ({
          type: c.type,
          issuer: c.issuer,
        })),
        approvalLimit,
        message: 'Demo setup complete - Alice credentials loaded',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /wallet/demo/state
   * Return current wallet state for demo UI
   */
  app.get('/wallet/demo/state', (req, res) => {
    const credentials = Array.from(credentialStore.values()).map((cred) => ({
      type: cred.type.filter((t) => t !== 'VerifiableCredential'),
      issuer: cred.issuer,
      subject: cred.credentialSubject,
    }));

    // Extract approval limit if available
    const financeCredential = Array.from(credentialStore.values()).find((c) =>
      c.type.includes('FinanceApproverCredential')
    );
    const approvalLimit = financeCredential
      ? (financeCredential.credentialSubject as { approvalLimit?: number }).approvalLimit
      : undefined;

    res.json({
      holder: holderDid,
      credentialCount: credentialStore.size,
      credentials,
      approvalLimit, // THE CRYPTOGRAPHIC CEILING - highlighted for demo
    });
  });

  // Start server
  startServer(app, PORT, 'vc-wallet');
}

main().catch((error) => {
  console.error('[VC Wallet] Failed to start:', error);
  process.exit(1);
});
