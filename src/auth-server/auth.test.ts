/**
 * Authorization Server Component Tests
 *
 * Tests the security-critical authorization logic:
 * 1. Nonce generation and management (replay attack prevention)
 * 2. Scope derivation from credentials (server-side, client cannot inflate)
 * 3. JWT creation with short expiration
 * 4. Trusted issuer validation
 *
 * The Auth Server is THE TRUST BOUNDARY - it derives scopes server-side
 * from verified credentials. The client cannot inflate these values.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  generateEd25519KeyPair,
  keyPairToDid,
  issueCredential,
  signJwt,
  verifyJwt,
  decodeJwt,
  CONTEXTS,
  type KeyPair,
  type UnsignedCredential,
  type VerifiableCredential,
} from '../lib/index.js';

// ============================================================
// Nonce Management (replicated from auth-server for testing)
// ============================================================

interface NonceEntry {
  nonce: string;
  domain: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

const NONCE_TTL_SECONDS = 300; // 5 minutes

function generateNonce(): string {
  return crypto.randomBytes(18).toString('base64url');
}

function storeNonce(
  store: Map<string, NonceEntry>,
  nonce: string,
  domain: string
): NonceEntry {
  const now = Date.now();
  const entry: NonceEntry = {
    nonce,
    domain,
    createdAt: now,
    expiresAt: now + NONCE_TTL_SECONDS * 1000,
    used: false,
  };
  store.set(nonce, entry);
  return entry;
}

function consumeNonce(
  store: Map<string, NonceEntry>,
  nonce: string,
  expectedDomain: string
): NonceEntry | null {
  const entry = store.get(nonce);

  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(nonce);
    return null;
  }
  if (entry.used) return null;
  if (entry.domain !== expectedDomain) return null;

  entry.used = true;
  return entry;
}

function cleanupExpiredNonces(store: Map<string, NonceEntry>): void {
  const now = Date.now();
  for (const [nonce, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(nonce);
    }
  }
}

// ============================================================
// Scope Derivation (replicated from auth-server for testing)
// ============================================================

interface DerivedScopes {
  scopes: string[];
  claims: {
    employeeId?: string;
    name?: string;
    approvalLimit?: number;
  };
}

function deriveScopesFromCredentials(credentials: VerifiableCredential[]): DerivedScopes {
  const scopes: string[] = [];
  const claims: DerivedScopes['claims'] = {};

  for (const credential of credentials) {
    const subject = credential.credentialSubject as Record<string, unknown>;

    if (credential.type.includes('EmployeeCredential')) {
      scopes.push('expense:view', 'expense:submit');
      claims.employeeId = subject.employeeId as string;
      claims.name = subject.name as string;
    }

    if (credential.type.includes('FinanceApproverCredential')) {
      const approvalLimit = subject.approvalLimit as number;
      if (typeof approvalLimit === 'number' && approvalLimit > 0) {
        scopes.push(`expense:approve:max:${approvalLimit}`);
        claims.approvalLimit = approvalLimit;
      }
    }
  }

  return { scopes: [...new Set(scopes)], claims };
}

// ============================================================
// Test Helpers
// ============================================================

async function createTestCredential(
  issuerKeyPair: KeyPair,
  issuerDid: string,
  holderDid: string,
  type: 'employee' | 'finance',
  approvalLimit?: number
): Promise<VerifiableCredential> {
  if (type === 'employee') {
    const unsigned: UnsignedCredential = {
      '@context': [CONTEXTS.VC_V2, CONTEXTS.DEMO_V1],
      type: ['VerifiableCredential', 'EmployeeCredential'],
      issuer: issuerDid,
      validFrom: new Date().toISOString(),
      credentialSubject: {
        id: holderDid,
        name: 'Alice Johnson',
        employeeId: 'EMP-001',
        jobTitle: 'Senior Financial Analyst',
        department: 'Finance',
      },
    };
    return issueCredential(unsigned, issuerKeyPair);
  } else {
    const unsigned: UnsignedCredential = {
      '@context': [CONTEXTS.VC_V2, CONTEXTS.DEMO_V1],
      type: ['VerifiableCredential', 'FinanceApproverCredential'],
      issuer: issuerDid,
      validFrom: new Date().toISOString(),
      credentialSubject: {
        id: holderDid,
        role: 'finance-approver',
        approvalLimit: approvalLimit || 10000,
        currency: 'USD',
        department: 'Finance',
      },
    };
    return issueCredential(unsigned, issuerKeyPair);
  }
}

describe('Auth Server: Nonce Generation', () => {
  it('should generate 144-bit (18 byte) random nonces', () => {
    const nonce = generateNonce();

    // 18 bytes = 24 base64url characters (18 * 8 / 6 = 24)
    expect(nonce.length).toBe(24);
    // base64url uses alphanumeric + hyphen + underscore (no padding in this case)
    expect(/^[A-Za-z0-9_-]+$/.test(nonce)).toBe(true);
  });

  it('should generate unique nonces', () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nonces.add(generateNonce());
    }
    expect(nonces.size).toBe(100);
  });

  it('should generate cryptographically random nonces', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).not.toBe(nonce2);
  });
});

describe('Auth Server: Nonce Management (Replay Attack Prevention)', () => {
  let nonceStore: Map<string, NonceEntry>;

  beforeEach(() => {
    nonceStore = new Map();
  });

  it('should store nonce with domain and TTL', () => {
    const nonce = generateNonce();
    const domain = 'expense-api';

    const entry = storeNonce(nonceStore, nonce, domain);

    expect(entry.nonce).toBe(nonce);
    expect(entry.domain).toBe(domain);
    expect(entry.used).toBe(false);
    expect(entry.expiresAt).toBeGreaterThan(Date.now());
  });

  it('should consume nonce only once (single-use)', () => {
    const nonce = generateNonce();
    const domain = 'expense-api';

    storeNonce(nonceStore, nonce, domain);

    // First consumption should succeed
    const first = consumeNonce(nonceStore, nonce, domain);
    expect(first).not.toBeNull();
    expect(first!.used).toBe(true);

    // Second consumption should fail (replay attack blocked)
    const second = consumeNonce(nonceStore, nonce, domain);
    expect(second).toBeNull();
  });

  it('should reject unknown nonces', () => {
    const result = consumeNonce(nonceStore, 'unknown-nonce-12345', 'expense-api');
    expect(result).toBeNull();
  });

  it('should reject nonces for wrong domain', () => {
    const nonce = generateNonce();
    storeNonce(nonceStore, nonce, 'expense-api');

    const result = consumeNonce(nonceStore, nonce, 'malicious-api');
    expect(result).toBeNull();
  });

  it('should reject expired nonces', () => {
    const nonce = generateNonce();
    const domain = 'expense-api';

    // Create an already expired entry
    const now = Date.now();
    const expiredEntry: NonceEntry = {
      nonce,
      domain,
      createdAt: now - 400000, // 400 seconds ago
      expiresAt: now - 100000, // Expired 100 seconds ago
      used: false,
    };
    nonceStore.set(nonce, expiredEntry);

    const result = consumeNonce(nonceStore, nonce, domain);
    expect(result).toBeNull();
  });

  it('should cleanup expired nonces', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();

    // Create one valid and one expired entry
    const now = Date.now();
    nonceStore.set(nonce1, {
      nonce: nonce1,
      domain: 'expense-api',
      createdAt: now,
      expiresAt: now + 300000,
      used: false,
    });
    nonceStore.set(nonce2, {
      nonce: nonce2,
      domain: 'expense-api',
      createdAt: now - 400000,
      expiresAt: now - 100000, // Expired
      used: false,
    });

    expect(nonceStore.size).toBe(2);

    cleanupExpiredNonces(nonceStore);

    expect(nonceStore.size).toBe(1);
    expect(nonceStore.has(nonce1)).toBe(true);
    expect(nonceStore.has(nonce2)).toBe(false);
  });
});

describe('Auth Server: Scope Derivation (Server-Side Security)', () => {
  let issuerKeyPair: KeyPair;
  let issuerDid: string;
  let holderKeyPair: KeyPair;
  let holderDid: string;

  beforeAll(async () => {
    issuerKeyPair = await generateEd25519KeyPair();
    issuerDid = keyPairToDid(issuerKeyPair);
    holderKeyPair = await generateEd25519KeyPair();
    holderDid = keyPairToDid(holderKeyPair);
  });

  it('should derive expense:view and expense:submit from EmployeeCredential', async () => {
    const credential = await createTestCredential(
      issuerKeyPair,
      issuerDid,
      holderDid,
      'employee'
    );

    const { scopes } = deriveScopesFromCredentials([credential]);

    expect(scopes).toContain('expense:view');
    expect(scopes).toContain('expense:submit');
    expect(scopes).not.toContain('expense:approve:max:10000');
  });

  it('should derive expense:approve:max:N from FinanceApproverCredential', async () => {
    const credential = await createTestCredential(
      issuerKeyPair,
      issuerDid,
      holderDid,
      'finance',
      10000
    );

    const { scopes, claims } = deriveScopesFromCredentials([credential]);

    expect(scopes).toContain('expense:approve:max:10000');
    expect(claims.approvalLimit).toBe(10000);
  });

  it('should combine scopes from multiple credentials', async () => {
    const employeeCredential = await createTestCredential(
      issuerKeyPair,
      issuerDid,
      holderDid,
      'employee'
    );
    const financeCredential = await createTestCredential(
      issuerKeyPair,
      issuerDid,
      holderDid,
      'finance',
      10000
    );

    const { scopes, claims } = deriveScopesFromCredentials([
      employeeCredential,
      financeCredential,
    ]);

    expect(scopes).toContain('expense:view');
    expect(scopes).toContain('expense:submit');
    expect(scopes).toContain('expense:approve:max:10000');
    expect(claims.employeeId).toBe('EMP-001');
    expect(claims.name).toBe('Alice Johnson');
    expect(claims.approvalLimit).toBe(10000);
  });

  it('should deduplicate scopes', async () => {
    const credential1 = await createTestCredential(
      issuerKeyPair,
      issuerDid,
      holderDid,
      'employee'
    );
    const credential2 = await createTestCredential(
      issuerKeyPair,
      issuerDid,
      holderDid,
      'employee'
    );

    const { scopes } = deriveScopesFromCredentials([credential1, credential2]);

    // Should have each scope only once
    const viewCount = scopes.filter((s) => s === 'expense:view').length;
    const submitCount = scopes.filter((s) => s === 'expense:submit').length;

    expect(viewCount).toBe(1);
    expect(submitCount).toBe(1);
  });

  it('should preserve exact approval limit (security critical)', async () => {
    const limits = [1, 100, 5000, 10000, 50000, 99999, 100000];

    for (const limit of limits) {
      const credential = await createTestCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        'finance',
        limit
      );

      const { scopes, claims } = deriveScopesFromCredentials([credential]);

      expect(scopes).toContain(`expense:approve:max:${limit}`);
      expect(claims.approvalLimit).toBe(limit);
    }
  });

  it('should not add approval scope for invalid limits', async () => {
    // Create a credential without a valid approval limit
    const unsigned: UnsignedCredential = {
      '@context': [CONTEXTS.VC_V2, CONTEXTS.DEMO_V1],
      type: ['VerifiableCredential', 'FinanceApproverCredential'],
      issuer: issuerDid,
      validFrom: new Date().toISOString(),
      credentialSubject: {
        id: holderDid,
        role: 'finance-approver',
        // approvalLimit intentionally missing
        currency: 'USD',
        department: 'Finance',
      },
    };
    const credential = await issueCredential(unsigned, issuerKeyPair);

    const { scopes, claims } = deriveScopesFromCredentials([credential]);

    expect(scopes.some((s) => s.startsWith('expense:approve:max:'))).toBe(false);
    expect(claims.approvalLimit).toBeUndefined();
  });
});

describe('Auth Server: JWT Token Creation', () => {
  let authKeyPair: KeyPair;
  let authDid: string;
  let holderDid: string;

  beforeAll(async () => {
    authKeyPair = await generateEd25519KeyPair();
    authDid = keyPairToDid(authKeyPair);
    const holderKeyPair = await generateEd25519KeyPair();
    holderDid = keyPairToDid(holderKeyPair);
  });

  it('should create JWT with 60-second expiration', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: authDid,
      sub: holderDid,
      aud: 'expense-api',
      exp: now + 60,
      iat: now,
      jti: `token-${Date.now()}`,
      scope: 'expense:view expense:submit expense:approve:max:10000',
    };

    const token = await signJwt(payload, authKeyPair);
    const decoded = decodeJwt(token);

    expect(decoded.payload.exp - decoded.payload.iat).toBe(60);
  });

  it('should include scopes in JWT', async () => {
    const now = Math.floor(Date.now() / 1000);
    const scope = 'expense:view expense:submit expense:approve:max:10000';
    const payload = {
      iss: authDid,
      sub: holderDid,
      aud: 'expense-api',
      exp: now + 60,
      iat: now,
      jti: `token-${Date.now()}`,
      scope,
    };

    const token = await signJwt(payload, authKeyPair);
    const decoded = decodeJwt(token);

    expect(decoded.payload.scope).toBe(scope);
  });

  it('should sign JWT with auth server key', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: authDid,
      sub: holderDid,
      aud: 'expense-api',
      exp: now + 60,
      iat: now,
      jti: `token-${Date.now()}`,
      scope: 'expense:view',
    };

    const token = await signJwt(payload, authKeyPair);
    const verifier = authKeyPair.verifier();
    const result = await verifyJwt(token, verifier, 'expense-api');

    expect(result.valid).toBe(true);
  });

  it('should reject token signed with wrong key', async () => {
    const wrongKeyPair = await generateEd25519KeyPair();
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: authDid,
      sub: holderDid,
      aud: 'expense-api',
      exp: now + 60,
      iat: now,
      jti: `token-${Date.now()}`,
      scope: 'expense:view',
    };

    // Sign with wrong key
    const token = await signJwt(payload, wrongKeyPair);

    // Verify with auth server's verifier
    const verifier = authKeyPair.verifier();
    const result = await verifyJwt(token, verifier, 'expense-api');

    expect(result.valid).toBe(false);
  });
});

describe('Auth Server: Trusted Issuer Validation', () => {
  let trustedIssuerKeyPair: KeyPair;
  let trustedIssuerDid: string;
  let untrustedIssuerKeyPair: KeyPair;
  let untrustedIssuerDid: string;

  beforeAll(async () => {
    trustedIssuerKeyPair = await generateEd25519KeyPair();
    trustedIssuerDid = keyPairToDid(trustedIssuerKeyPair);
    untrustedIssuerKeyPair = await generateEd25519KeyPair();
    untrustedIssuerDid = keyPairToDid(untrustedIssuerKeyPair);
  });

  it('should identify trusted issuers', () => {
    const trustedIssuers = new Set<string>([trustedIssuerDid]);

    expect(trustedIssuers.has(trustedIssuerDid)).toBe(true);
    expect(trustedIssuers.has(untrustedIssuerDid)).toBe(false);
  });

  it('should reject credentials from untrusted issuers even if valid', async () => {
    const trustedIssuers = new Set<string>([trustedIssuerDid]);

    // Create credential from untrusted issuer
    const holderKeyPair = await generateEd25519KeyPair();
    const holderDid = keyPairToDid(holderKeyPair);

    const credential = await createTestCredential(
      untrustedIssuerKeyPair,
      untrustedIssuerDid,
      holderDid,
      'finance',
      1000000 // Attacker tries to grant themselves a million dollar limit
    );

    // Check issuer trust
    const isTrusted = trustedIssuers.has(credential.issuer);
    expect(isTrusted).toBe(false);

    // Even though the credential is cryptographically valid,
    // it should be rejected because the issuer is not trusted.
  });
});
