/**
 * Tests for Credential Utilities Module
 *
 * Tests VC 2.0 credential issuance and verification with DataIntegrityProof
 * using eddsa-rdfc-2022 cryptosuite.
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
  isCredentialExpired,
  isCredentialNotYetValid,
  getCredentialTypes,
  CONTEXTS,
} from './index.js';
import type { KeyPair, DocumentLoader, UnsignedCredential } from './index.js';
import type { VerifiableCredential } from '../../shared/types.js';

describe('Credential Utilities', () => {
  let issuerKeyPair: KeyPair;
  let holderKeyPair: KeyPair;
  let issuerDid: string;
  let holderDid: string;
  let documentLoader: DocumentLoader;

  beforeAll(async () => {
    issuerKeyPair = await generateEd25519KeyPair();
    holderKeyPair = await generateEd25519KeyPair();
    issuerDid = keyPairToDid(issuerKeyPair);
    holderDid = keyPairToDid(holderKeyPair);
    documentLoader = createDocumentLoader();
  });

  describe('Credential Issuance', () => {
    it('should issue a VerifiableCredential with DataIntegrityProof', async () => {
      // Use CONTEXTS.VC_V2 which is the proper context for VC 2.0
      // All properties in credentialSubject need to be in the context or use the @vocab
      const credential: UnsignedCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: new Date().toISOString(),
        credentialSubject: {
          id: holderDid,
        },
      };

      const signedCredential = await issueCredential(
        credential,
        issuerKeyPair,
        documentLoader
      );

      expect(signedCredential).toBeDefined();
      expect(signedCredential.proof).toBeDefined();
      expect(signedCredential.proof.type).toBe('DataIntegrityProof');
      expect(signedCredential.proof.cryptosuite).toBe('eddsa-rdfc-2022');
      expect(signedCredential.proof.proofPurpose).toBe('assertionMethod');
      expect(signedCredential.proof.proofValue).toBeDefined();
    });

    it('should verify a valid credential', async () => {
      const credential: UnsignedCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: new Date().toISOString(),
        credentialSubject: {
          id: holderDid,
        },
      };

      const signedCredential = await issueCredential(
        credential,
        issuerKeyPair,
        documentLoader
      );

      const result = await verifyCredential(signedCredential, documentLoader);

      expect(result.verified).toBe(true);
    });

    it('should detect tampered credential', async () => {
      const credential: UnsignedCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: new Date().toISOString(),
        credentialSubject: {
          id: holderDid,
        },
      };

      const signedCredential = await issueCredential(
        credential,
        issuerKeyPair,
        documentLoader
      );

      // Tamper with the credential by changing validFrom
      const tamperedCredential = {
        ...signedCredential,
        validFrom: '2020-01-01T00:00:00Z',
      };

      const result = await verifyCredential(
        tamperedCredential as VerifiableCredential,
        documentLoader
      );

      expect(result.verified).toBe(false);
    });
  });

  describe('Verifiable Presentations', () => {
    it('should create and sign a presentation with challenge/domain binding', async () => {
      // Issue a credential first
      const credential: UnsignedCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: new Date().toISOString(),
        credentialSubject: {
          id: holderDid,
        },
      };

      const signedCredential = await issueCredential(
        credential,
        issuerKeyPair,
        documentLoader
      );

      // Create presentation
      const presentation = createPresentation([signedCredential], holderDid);

      expect(presentation['@context']).toContain(CONTEXTS.VC_V2);
      expect(presentation.type).toContain('VerifiablePresentation');
      expect(presentation.holder).toBe(holderDid);
      expect(presentation.verifiableCredential).toHaveLength(1);

      // Sign presentation
      const challenge = 'test-challenge-123';
      const domain = 'test.example.com';

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
      expect(signedPresentation.proof.proofPurpose).toBe('authentication');
    });

    it('should verify a valid presentation with challenge/domain', async () => {
      const credential: UnsignedCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: new Date().toISOString(),
        credentialSubject: {
          id: holderDid,
        },
      };

      const signedCredential = await issueCredential(
        credential,
        issuerKeyPair,
        documentLoader
      );

      const presentation = createPresentation([signedCredential], holderDid);
      const challenge = 'verify-test-challenge';
      const domain = 'verify.example.com';

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

    it('should reject presentation with wrong challenge', async () => {
      const credential: UnsignedCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: new Date().toISOString(),
        credentialSubject: {
          id: holderDid,
        },
      };

      const signedCredential = await issueCredential(
        credential,
        issuerKeyPair,
        documentLoader
      );

      const presentation = createPresentation([signedCredential], holderDid);
      const challenge = 'original-challenge';
      const domain = 'test.example.com';

      const signedPresentation = await signPresentation(
        presentation,
        holderKeyPair,
        challenge,
        domain,
        documentLoader
      );

      // Verify with wrong challenge
      const result = await verifyPresentation(
        signedPresentation,
        'wrong-challenge',
        domain,
        documentLoader
      );

      expect(result.verified).toBe(false);
    });

    it('should reject presentation with wrong domain', async () => {
      const credential: UnsignedCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: new Date().toISOString(),
        credentialSubject: {
          id: holderDid,
        },
      };

      const signedCredential = await issueCredential(
        credential,
        issuerKeyPair,
        documentLoader
      );

      const presentation = createPresentation([signedCredential], holderDid);
      const challenge = 'domain-test-challenge';
      const domain = 'original.example.com';

      const signedPresentation = await signPresentation(
        presentation,
        holderKeyPair,
        challenge,
        domain,
        documentLoader
      );

      // Verify with wrong domain
      const result = await verifyPresentation(
        signedPresentation,
        challenge,
        'wrong.example.com',
        documentLoader
      );

      expect(result.verified).toBe(false);
    });
  });

  describe('Credential Validation Helpers', () => {
    it('should detect expired credential', () => {
      // Mock credential for validation helper testing (doesn't need full proof)
      const expiredCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: '2020-01-01T00:00:00Z',
        validUntil: '2020-12-31T23:59:59Z', // Expired
        credentialSubject: { id: holderDid },
      } as unknown as VerifiableCredential;

      expect(isCredentialExpired(expiredCredential)).toBe(true);
    });

    it('should not mark non-expired credential as expired', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const validCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: new Date().toISOString(),
        validUntil: futureDate.toISOString(),
        credentialSubject: { id: holderDid },
      } as unknown as VerifiableCredential;

      expect(isCredentialExpired(validCredential)).toBe(false);
    });

    it('should detect credential not yet valid', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const futureCredential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential'],
        issuer: issuerDid,
        validFrom: futureDate.toISOString(),
        credentialSubject: { id: holderDid },
      } as unknown as VerifiableCredential;

      expect(isCredentialNotYetValid(futureCredential)).toBe(true);
    });

    it('should extract credential types excluding VerifiableCredential', () => {
      // Note: getCredentialTypes filters OUT 'VerifiableCredential' to return only specific types
      const credential = {
        '@context': [CONTEXTS.VC_V2],
        type: ['VerifiableCredential', 'EmployeeCredential', 'FinanceApproverCredential'],
        issuer: issuerDid,
        validFrom: new Date().toISOString(),
        credentialSubject: { id: holderDid },
      } as unknown as VerifiableCredential;

      const types = getCredentialTypes(credential);

      // getCredentialTypes returns types OTHER than VerifiableCredential
      expect(types).not.toContain('VerifiableCredential');
      expect(types).toContain('EmployeeCredential');
      expect(types).toContain('FinanceApproverCredential');
      expect(types).toHaveLength(2);
    });
  });
});
