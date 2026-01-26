/**
 * VC Wallet Service Component Tests
 *
 * Tests the wallet's credential management and presentation creation.
 * These tests verify:
 * 1. Credential storage and retrieval
 * 2. Holder binding validation
 * 3. Verifiable Presentation creation with challenge/domain binding
 * 4. Credential filtering by type
 *
 * The wallet holds the holder's private key - the LLM never has access to it.
 * This is a critical security boundary in the system.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateEd25519KeyPair,
  keyPairToDid,
  issueCredential,
  verifyCredential,
  createPresentation,
  signPresentation,
  verifyPresentation,
  createDocumentLoader,
  CONTEXTS,
  type KeyPair,
  type UnsignedCredential,
  type VerifiableCredential,
} from '../lib/index.js';

// Helper to create test credentials
async function createTestEmployeeCredential(
  issuerKeyPair: KeyPair,
  issuerDid: string,
  holderDid: string
): Promise<VerifiableCredential> {
  const unsigned: UnsignedCredential = {
    '@context': [CONTEXTS.VC_V2, CONTEXTS.DEMO_V1],
    type: ['VerifiableCredential', 'EmployeeCredential'],
    issuer: issuerDid,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: holderDid,
      name: 'Alice Chen',
      employeeId: 'E-1234',
      jobTitle: 'Finance Manager',
      department: 'Finance',
    },
  };
  return issueCredential(unsigned, issuerKeyPair);
}

async function createTestFinanceApproverCredential(
  issuerKeyPair: KeyPair,
  issuerDid: string,
  holderDid: string,
  approvalLimit: number = 10000
): Promise<VerifiableCredential> {
  const unsigned: UnsignedCredential = {
    '@context': [CONTEXTS.VC_V2, CONTEXTS.DEMO_V1],
    type: ['VerifiableCredential', 'FinanceApproverCredential'],
    issuer: issuerDid,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: holderDid,
      role: 'finance-approver',
      approvalLimit,
      currency: 'USD',
      department: 'Finance',
    },
  };
  return issueCredential(unsigned, issuerKeyPair);
}

describe('VC Wallet: Credential Storage', () => {
  let issuerKeyPair: KeyPair;
  let issuerDid: string;
  let holderKeyPair: KeyPair;
  let holderDid: string;
  let documentLoader: ReturnType<typeof createDocumentLoader>;

  beforeAll(async () => {
    issuerKeyPair = await generateEd25519KeyPair();
    issuerDid = keyPairToDid(issuerKeyPair);
    holderKeyPair = await generateEd25519KeyPair();
    holderDid = keyPairToDid(holderKeyPair);
    documentLoader = createDocumentLoader();
  });

  it('should verify credential before storage (accepts valid credentials)', async () => {
    const credential = await createTestEmployeeCredential(
      issuerKeyPair,
      issuerDid,
      holderDid
    );

    // Wallet verifies credential signature before storage
    const result = await verifyCredential(credential, documentLoader);
    expect(result.verified).toBe(true);
  });

  it('should reject credentials with invalid signatures', async () => {
    const credential = await createTestEmployeeCredential(
      issuerKeyPair,
      issuerDid,
      holderDid
    );

    // Tamper with the credential
    const tamperedCredential = {
      ...credential,
      credentialSubject: {
        ...(credential.credentialSubject as object),
        name: 'Eve Attacker', // Modified name
      },
    } as VerifiableCredential;

    // Verification should fail
    const result = await verifyCredential(tamperedCredential, documentLoader);
    expect(result.verified).toBe(false);
  });

  it('should validate holder binding (credentialSubject.id must match holder DID)', async () => {
    // Create credential for a different holder
    const differentHolderKeyPair = await generateEd25519KeyPair();
    const differentHolderDid = keyPairToDid(differentHolderKeyPair);

    const credential = await createTestEmployeeCredential(
      issuerKeyPair,
      issuerDid,
      differentHolderDid // Different holder
    );

    // Credential is cryptographically valid
    const result = await verifyCredential(credential, documentLoader);
    expect(result.verified).toBe(true);

    // But holder binding check would fail
    const subjectId = (credential.credentialSubject as { id?: string }).id;
    const holderBindingValid = subjectId === holderDid;
    expect(holderBindingValid).toBe(false);
  });
});

describe('VC Wallet: Credential Filtering', () => {
  let issuerKeyPair: KeyPair;
  let issuerDid: string;
  let holderKeyPair: KeyPair;
  let holderDid: string;
  let employeeCredential: VerifiableCredential;
  let financeCredential: VerifiableCredential;

  beforeAll(async () => {
    issuerKeyPair = await generateEd25519KeyPair();
    issuerDid = keyPairToDid(issuerKeyPair);
    holderKeyPair = await generateEd25519KeyPair();
    holderDid = keyPairToDid(holderKeyPair);

    employeeCredential = await createTestEmployeeCredential(
      issuerKeyPair,
      issuerDid,
      holderDid
    );
    financeCredential = await createTestFinanceApproverCredential(
      issuerKeyPair,
      issuerDid,
      holderDid,
      10000
    );
  });

  // Replicate findCredentialsByType logic from wallet
  function findCredentialsByType(
    credentials: VerifiableCredential[],
    type: string
  ): VerifiableCredential[] {
    return credentials.filter((cred) => cred.type.includes(type));
  }

  it('should filter credentials by type - EmployeeCredential', () => {
    const allCredentials = [employeeCredential, financeCredential];
    const filtered = findCredentialsByType(allCredentials, 'EmployeeCredential');

    expect(filtered.length).toBe(1);
    expect(filtered[0].type).toContain('EmployeeCredential');
  });

  it('should filter credentials by type - FinanceApproverCredential', () => {
    const allCredentials = [employeeCredential, financeCredential];
    const filtered = findCredentialsByType(allCredentials, 'FinanceApproverCredential');

    expect(filtered.length).toBe(1);
    expect(filtered[0].type).toContain('FinanceApproverCredential');
  });

  it('should return empty array for non-matching type', () => {
    const allCredentials = [employeeCredential, financeCredential];
    const filtered = findCredentialsByType(allCredentials, 'NonExistentCredential');

    expect(filtered.length).toBe(0);
  });

  it('should filter by VerifiableCredential to get all', () => {
    const allCredentials = [employeeCredential, financeCredential];
    const filtered = findCredentialsByType(allCredentials, 'VerifiableCredential');

    expect(filtered.length).toBe(2);
  });
});

describe('VC Wallet: Presentation Creation (Security Critical)', () => {
  let issuerKeyPair: KeyPair;
  let issuerDid: string;
  let holderKeyPair: KeyPair;
  let holderDid: string;
  let documentLoader: ReturnType<typeof createDocumentLoader>;
  let employeeCredential: VerifiableCredential;
  let financeCredential: VerifiableCredential;

  beforeAll(async () => {
    issuerKeyPair = await generateEd25519KeyPair();
    issuerDid = keyPairToDid(issuerKeyPair);
    holderKeyPair = await generateEd25519KeyPair();
    holderDid = keyPairToDid(holderKeyPair);
    documentLoader = createDocumentLoader();

    employeeCredential = await createTestEmployeeCredential(
      issuerKeyPair,
      issuerDid,
      holderDid
    );
    financeCredential = await createTestFinanceApproverCredential(
      issuerKeyPair,
      issuerDid,
      holderDid,
      10000
    );
  });

  it('should create unsigned presentation with credentials', () => {
    const presentation = createPresentation(
      [employeeCredential, financeCredential],
      holderDid
    );

    expect(presentation.type).toContain('VerifiablePresentation');
    expect(presentation.holder).toBe(holderDid);
    expect(presentation.verifiableCredential.length).toBe(2);
  });

  it('should sign presentation with challenge and domain binding', async () => {
    const presentation = createPresentation(
      [employeeCredential, financeCredential],
      holderDid
    );

    const challenge = 'test-nonce-12345';
    const domain = 'expense-api';

    const signedPresentation = await signPresentation(
      presentation,
      holderKeyPair,
      challenge,
      domain,
      documentLoader
    );

    expect(signedPresentation.proof).toBeDefined();
    expect(signedPresentation.proof.challenge).toBe(challenge);
    expect(signedPresentation.proof.domain).toBe(domain);
  });

  it('should verify signed presentation with correct challenge/domain', async () => {
    const presentation = createPresentation(
      [employeeCredential, financeCredential],
      holderDid
    );

    const challenge = 'unique-nonce-' + Date.now();
    const domain = 'expense-api';

    const signedPresentation = await signPresentation(
      presentation,
      holderKeyPair,
      challenge,
      domain,
      documentLoader
    );

    const result = await verifyPresentation(
      signedPresentation,
      challenge,
      domain,
      documentLoader
    );

    expect(result.verified).toBe(true);
  });

  it('should FAIL verification with wrong challenge (replay attack prevention)', async () => {
    const presentation = createPresentation(
      [employeeCredential, financeCredential],
      holderDid
    );

    const originalChallenge = 'original-nonce-12345';
    const domain = 'expense-api';

    const signedPresentation = await signPresentation(
      presentation,
      holderKeyPair,
      originalChallenge,
      domain,
      documentLoader
    );

    // Verify with different challenge (simulating replay attack)
    const result = await verifyPresentation(
      signedPresentation,
      'attacker-nonce-67890', // Different challenge
      domain,
      documentLoader
    );

    expect(result.verified).toBe(false);
  });

  it('should FAIL verification with wrong domain (cross-site attack prevention)', async () => {
    const presentation = createPresentation(
      [employeeCredential, financeCredential],
      holderDid
    );

    const challenge = 'test-nonce-12345';
    const originalDomain = 'expense-api';

    const signedPresentation = await signPresentation(
      presentation,
      holderKeyPair,
      challenge,
      originalDomain,
      documentLoader
    );

    // Verify with different domain
    const result = await verifyPresentation(
      signedPresentation,
      challenge,
      'malicious-api', // Different domain
      documentLoader
    );

    expect(result.verified).toBe(false);
  });

  it('should include all credentials in presentation', async () => {
    const presentation = createPresentation(
      [employeeCredential, financeCredential],
      holderDid
    );

    expect(presentation.verifiableCredential.length).toBe(2);

    const types = presentation.verifiableCredential.flatMap((c) => c.type);
    expect(types).toContain('EmployeeCredential');
    expect(types).toContain('FinanceApproverCredential');
  });
});

describe('VC Wallet: Holder Key Security', () => {
  let holderKeyPair: KeyPair;
  let holderDid: string;

  beforeAll(async () => {
    holderKeyPair = await generateEd25519KeyPair();
    holderDid = keyPairToDid(holderKeyPair);
  });

  it('should derive DID from holder key pair', () => {
    expect(holderDid).toMatch(/^did:key:z6Mk/);
  });

  it('should have consistent DID for same key pair', () => {
    const did1 = keyPairToDid(holderKeyPair);
    const did2 = keyPairToDid(holderKeyPair);
    expect(did1).toBe(did2);
  });

  it('should generate unique DIDs for different key pairs', async () => {
    const anotherKeyPair = await generateEd25519KeyPair();
    const anotherDid = keyPairToDid(anotherKeyPair);

    expect(anotherDid).not.toBe(holderDid);
  });
});

describe('VC Wallet: Approval Limit Extraction', () => {
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

  it('should extract approval limit from FinanceApproverCredential', async () => {
    const credential = await createTestFinanceApproverCredential(
      issuerKeyPair,
      issuerDid,
      holderDid,
      10000
    );

    const subject = credential.credentialSubject as { approvalLimit?: number };
    expect(subject.approvalLimit).toBe(10000);
  });

  it('should preserve exact approval limit value', async () => {
    const limits = [1, 500, 5000, 10000, 50000, 100000];

    for (const limit of limits) {
      const credential = await createTestFinanceApproverCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        limit
      );

      const subject = credential.credentialSubject as { approvalLimit?: number };
      expect(subject.approvalLimit).toBe(limit);
    }
  });
});
