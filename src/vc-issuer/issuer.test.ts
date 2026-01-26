/**
 * VC Issuer Service Component Tests
 *
 * Tests the credential creation logic and validation schemas.
 * These tests verify:
 * 1. EmployeeCredential structure and content
 * 2. FinanceApproverCredential structure and the cryptographic ceiling value
 * 3. Request validation schemas (Zod)
 *
 * The FinanceApproverCredential is critical because it contains the
 * approvalLimit - THE CRYPTOGRAPHIC CEILING that constrains LLM agent actions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import {
  generateEd25519KeyPair,
  keyPairToDid,
  issueCredential,
  verifyCredential,
  createDocumentLoader,
  CONTEXTS,
  type KeyPair,
  type UnsignedCredential,
  type VerifiableCredential,
} from '../lib/index.js';

// Zod schemas from vc-issuer (replicated for testing)
const EmployeeCredentialRequestSchema = z.object({
  subjectDid: z.string().startsWith('did:'),
  name: z.string().min(1),
  employeeId: z.string().min(1),
  jobTitle: z.string().min(1),
  department: z.string().min(1),
});

const FinanceApproverCredentialRequestSchema = z.object({
  subjectDid: z.string().startsWith('did:'),
  approvalLimit: z.number().positive(),
  department: z.string().min(1),
});

// Credential creation functions (replicated from vc-issuer for testing)
const ISSUER_NAME = 'Acme Corporation HR';

async function createEmployeeCredential(
  issuerKeyPair: KeyPair,
  issuerDid: string,
  subjectDid: string,
  name: string,
  employeeId: string,
  jobTitle: string,
  department: string
): Promise<VerifiableCredential> {
  const unsignedCredential: UnsignedCredential = {
    '@context': [CONTEXTS.VC_V2, CONTEXTS.DEMO_V1],
    type: ['VerifiableCredential', 'EmployeeCredential'],
    issuer: issuerDid,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: subjectDid,
      type: 'Person',
      name,
      employeeId,
      jobTitle,
      department,
      worksFor: {
        type: 'Organization',
        name: ISSUER_NAME.replace(' HR', ''),
      },
    },
  };

  return issueCredential(unsignedCredential, issuerKeyPair);
}

async function createFinanceApproverCredential(
  issuerKeyPair: KeyPair,
  issuerDid: string,
  subjectDid: string,
  approvalLimit: number,
  department: string
): Promise<VerifiableCredential> {
  const unsignedCredential: UnsignedCredential = {
    '@context': [CONTEXTS.VC_V2, CONTEXTS.DEMO_V1],
    type: ['VerifiableCredential', 'FinanceApproverCredential'],
    issuer: issuerDid,
    validFrom: new Date().toISOString(),
    credentialSubject: {
      id: subjectDid,
      role: 'finance-approver',
      approvalLimit, // THE CRYPTOGRAPHIC CEILING
      currency: 'USD',
      department,
    },
  };

  return issueCredential(unsignedCredential, issuerKeyPair);
}

describe('VC Issuer: Request Validation', () => {
  describe('EmployeeCredentialRequestSchema', () => {
    it('should accept valid employee credential request', () => {
      const request = {
        subjectDid: 'did:key:z6MkTest123',
        name: 'Alice Chen',
        employeeId: 'E-1234',
        jobTitle: 'Finance Manager',
        department: 'Finance',
      };

      const result = EmployeeCredentialRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject request with invalid DID', () => {
      const request = {
        subjectDid: 'not-a-did',
        name: 'Alice Chen',
        employeeId: 'E-1234',
        jobTitle: 'Finance Manager',
        department: 'Finance',
      };

      const result = EmployeeCredentialRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject request with empty name', () => {
      const request = {
        subjectDid: 'did:key:z6MkTest123',
        name: '',
        employeeId: 'E-1234',
        jobTitle: 'Finance Manager',
        department: 'Finance',
      };

      const result = EmployeeCredentialRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject request with missing fields', () => {
      const request = {
        subjectDid: 'did:key:z6MkTest123',
        name: 'Alice Chen',
        // missing employeeId, jobTitle, department
      };

      const result = EmployeeCredentialRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe('FinanceApproverCredentialRequestSchema', () => {
    it('should accept valid finance approver credential request', () => {
      const request = {
        subjectDid: 'did:key:z6MkTest123',
        approvalLimit: 10000,
        department: 'Finance',
      };

      const result = FinanceApproverCredentialRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should reject request with zero approval limit', () => {
      const request = {
        subjectDid: 'did:key:z6MkTest123',
        approvalLimit: 0,
        department: 'Finance',
      };

      const result = FinanceApproverCredentialRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject request with negative approval limit', () => {
      const request = {
        subjectDid: 'did:key:z6MkTest123',
        approvalLimit: -5000,
        department: 'Finance',
      };

      const result = FinanceApproverCredentialRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    it('should reject request with non-numeric approval limit', () => {
      const request = {
        subjectDid: 'did:key:z6MkTest123',
        approvalLimit: '10000', // string instead of number
        department: 'Finance',
      };

      const result = FinanceApproverCredentialRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });
});

describe('VC Issuer: Credential Creation', () => {
  let issuerKeyPair: KeyPair;
  let issuerDid: string;
  let holderDid: string;
  let documentLoader: ReturnType<typeof createDocumentLoader>;

  beforeAll(async () => {
    issuerKeyPair = await generateEd25519KeyPair();
    issuerDid = keyPairToDid(issuerKeyPair);

    const holderKeyPair = await generateEd25519KeyPair();
    holderDid = keyPairToDid(holderKeyPair);

    documentLoader = createDocumentLoader();
  });

  describe('EmployeeCredential', () => {
    it('should create a valid signed EmployeeCredential', async () => {
      const credential = await createEmployeeCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        'Alice Chen',
        'E-1234',
        'Finance Manager',
        'Finance'
      );

      expect(credential.type).toContain('VerifiableCredential');
      expect(credential.type).toContain('EmployeeCredential');
      expect(credential.issuer).toBe(issuerDid);
      expect(credential.proof).toBeDefined();
    });

    it('should include correct subject data in EmployeeCredential', async () => {
      const credential = await createEmployeeCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        'Alice Chen',
        'E-1234',
        'Finance Manager',
        'Finance'
      );

      const subject = credential.credentialSubject as Record<string, unknown>;
      expect(subject.id).toBe(holderDid);
      expect(subject.name).toBe('Alice Chen');
      expect(subject.employeeId).toBe('E-1234');
      expect(subject.jobTitle).toBe('Finance Manager');
      expect(subject.department).toBe('Finance');
    });

    it('should verify EmployeeCredential signature', async () => {
      const credential = await createEmployeeCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        'Alice Chen',
        'E-1234',
        'Finance Manager',
        'Finance'
      );

      const result = await verifyCredential(credential, documentLoader);
      expect(result.verified).toBe(true);
    });

    it('should include worksFor organization in credential', async () => {
      const credential = await createEmployeeCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        'Alice Chen',
        'E-1234',
        'Finance Manager',
        'Finance'
      );

      const subject = credential.credentialSubject as Record<string, unknown>;
      const worksFor = subject.worksFor as { type: string; name: string };
      expect(worksFor.type).toBe('Organization');
      expect(worksFor.name).toBe('Acme Corporation');
    });
  });

  describe('FinanceApproverCredential - THE CRYPTOGRAPHIC CEILING', () => {
    it('should create a valid signed FinanceApproverCredential', async () => {
      const credential = await createFinanceApproverCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        10000, // $10,000 approval limit - THE CEILING
        'Finance'
      );

      expect(credential.type).toContain('VerifiableCredential');
      expect(credential.type).toContain('FinanceApproverCredential');
      expect(credential.issuer).toBe(issuerDid);
      expect(credential.proof).toBeDefined();
    });

    it('should embed the approval limit (cryptographic ceiling) in credential', async () => {
      const approvalLimit = 10000;
      const credential = await createFinanceApproverCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        approvalLimit,
        'Finance'
      );

      const subject = credential.credentialSubject as { approvalLimit?: number };
      expect(subject.approvalLimit).toBe(approvalLimit);
    });

    it('should verify FinanceApproverCredential signature', async () => {
      const credential = await createFinanceApproverCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        10000,
        'Finance'
      );

      const result = await verifyCredential(credential, documentLoader);
      expect(result.verified).toBe(true);
    });

    it('should include finance-approver role in credential', async () => {
      const credential = await createFinanceApproverCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        10000,
        'Finance'
      );

      const subject = credential.credentialSubject as { role?: string };
      expect(subject.role).toBe('finance-approver');
    });

    it('should include currency in credential', async () => {
      const credential = await createFinanceApproverCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        10000,
        'Finance'
      );

      const subject = credential.credentialSubject as { currency?: string };
      expect(subject.currency).toBe('USD');
    });

    it('should preserve exact approval limit value (security-critical)', async () => {
      // This test verifies that the approval limit is stored exactly as specified.
      // Any rounding or modification would be a security vulnerability.
      const exactLimits = [1, 100, 9999, 10000, 50000, 100000, 999999];

      for (const limit of exactLimits) {
        const credential = await createFinanceApproverCredential(
          issuerKeyPair,
          issuerDid,
          holderDid,
          limit,
          'Finance'
        );

        const subject = credential.credentialSubject as { approvalLimit?: number };
        expect(subject.approvalLimit).toBe(limit);
      }
    });
  });

  describe('Credential Contexts', () => {
    it('should include VC 2.0 context', async () => {
      const credential = await createEmployeeCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        'Alice Chen',
        'E-1234',
        'Finance Manager',
        'Finance'
      );

      expect(credential['@context']).toContain(CONTEXTS.VC_V2);
    });

    it('should include DEMO_V1 context for custom properties', async () => {
      const credential = await createEmployeeCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        'Alice Chen',
        'E-1234',
        'Finance Manager',
        'Finance'
      );

      expect(credential['@context']).toContain(CONTEXTS.DEMO_V1);
    });
  });

  describe('Demo Alice Credentials', () => {
    it('should issue both credentials with correct demo values', async () => {
      // Employee credential for Alice
      const employeeCredential = await createEmployeeCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        'Alice Chen',
        'E-1234',
        'Finance Manager',
        'Finance'
      );

      // Finance approver credential with $10,000 limit
      const financeCredential = await createFinanceApproverCredential(
        issuerKeyPair,
        issuerDid,
        holderDid,
        10000, // THE CRYPTOGRAPHIC CEILING
        'Finance'
      );

      // Verify both credentials
      const empResult = await verifyCredential(employeeCredential, documentLoader);
      const finResult = await verifyCredential(financeCredential, documentLoader);

      expect(empResult.verified).toBe(true);
      expect(finResult.verified).toBe(true);

      // Verify the ceiling value
      const subject = financeCredential.credentialSubject as { approvalLimit?: number };
      expect(subject.approvalLimit).toBe(10000);
    });
  });
});
