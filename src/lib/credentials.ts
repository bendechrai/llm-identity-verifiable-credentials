/**
 * Credential Utilities
 *
 * Core VC 2.0 operations for issuing and verifying credentials and presentations.
 * Uses DataIntegrityProof with eddsa-rdfc-2022 cryptosuite.
 */

import * as vc from '@digitalbazaar/vc';
import { cryptosuite as eddsaRdfc2022Cryptosuite } from '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
import type { KeyPair } from './keys.js';
import { createDocumentLoader, CONTEXTS, type DocumentLoader } from './document-loader.js';
import type { VerifiableCredential, VerifiablePresentation, DataIntegrityProof as DataIntegrityProofType } from '../../shared/types.js';

/**
 * Create a DataIntegrity suite for signing/verification.
 * Uses the eddsa-rdfc-2022 cryptosuite (VC 2.0 compliant).
 */
export function createDataIntegritySuite(keyPair: KeyPair) {
  return new DataIntegrityProof({
    signer: keyPair.signer(),
    cryptosuite: eddsaRdfc2022Cryptosuite,
  });
}

/**
 * Create a DataIntegrity suite for verification only (no signing).
 */
export function createVerificationSuite() {
  return new DataIntegrityProof({
    cryptosuite: eddsaRdfc2022Cryptosuite,
  });
}

export interface UnsignedCredential {
  '@context': string[];
  type: string[];
  issuer: string;
  validFrom: string;
  validUntil?: string;
  credentialSubject: Record<string, unknown>;
}

/**
 * Issue (sign) a Verifiable Credential.
 * Adds a DataIntegrityProof with the eddsa-rdfc-2022 cryptosuite.
 */
export async function issueCredential(
  credential: UnsignedCredential,
  keyPair: KeyPair,
  documentLoader?: DocumentLoader
): Promise<VerifiableCredential> {
  const suite = createDataIntegritySuite(keyPair);
  const loader = documentLoader || createDocumentLoader();

  const signedCredential = await vc.issue({
    credential,
    suite,
    documentLoader: loader,
  });

  return signedCredential as VerifiableCredential;
}

export interface VerificationResult {
  verified: boolean;
  error?: string;
  results?: unknown[];
}

/**
 * Verify a Verifiable Credential.
 * Checks the DataIntegrityProof signature.
 */
export async function verifyCredential(
  credential: VerifiableCredential,
  documentLoader?: DocumentLoader
): Promise<VerificationResult> {
  const suite = createVerificationSuite();
  const loader = documentLoader || createDocumentLoader();

  try {
    const result = await vc.verifyCredential({
      credential,
      suite,
      documentLoader: loader,
    });

    return {
      verified: result.verified,
      error: result.error?.message,
      results: result.results,
    };
  } catch (error) {
    return {
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export interface UnsignedPresentation {
  '@context': string[];
  type: ['VerifiablePresentation'];
  holder: string;
  verifiableCredential: VerifiableCredential[];
}

/**
 * Create an unsigned Verifiable Presentation.
 * The presentation wraps one or more credentials for a specific holder.
 */
export function createPresentation(
  credentials: VerifiableCredential[],
  holder: string
): UnsignedPresentation {
  return {
    '@context': [CONTEXTS.VC_V2],
    type: ['VerifiablePresentation'],
    holder,
    verifiableCredential: credentials,
  };
}

/**
 * Sign a Verifiable Presentation with challenge/domain binding.
 * The challenge and domain are embedded in the proof to prevent replay attacks.
 *
 * @param presentation - The unsigned presentation
 * @param keyPair - The holder's key pair (for authentication proof)
 * @param challenge - The nonce from the auth server (prevents replay)
 * @param domain - The intended audience/domain (prevents token theft)
 * @param documentLoader - Optional custom document loader
 */
export async function signPresentation(
  presentation: UnsignedPresentation,
  keyPair: KeyPair,
  challenge: string,
  domain: string,
  documentLoader?: DocumentLoader
): Promise<VerifiablePresentation> {
  const suite = createDataIntegritySuite(keyPair);
  const loader = documentLoader || createDocumentLoader();

  const signedPresentation = await vc.signPresentation({
    presentation,
    suite,
    challenge,
    domain,
    documentLoader: loader,
  });

  return signedPresentation as VerifiablePresentation;
}

export interface PresentationVerificationResult {
  verified: boolean;
  credentialResults: Array<{
    verified: boolean;
    error?: string;
  }>;
  presentationResult?: {
    verified: boolean;
    error?: string;
  };
  error?: string;
}

/**
 * Verify a Verifiable Presentation with challenge/domain validation.
 *
 * @param presentation - The signed presentation
 * @param challenge - Expected challenge (must match proof)
 * @param domain - Expected domain (must match proof)
 * @param documentLoader - Optional custom document loader
 */
export async function verifyPresentation(
  presentation: VerifiablePresentation,
  challenge: string,
  domain: string,
  documentLoader?: DocumentLoader
): Promise<PresentationVerificationResult> {
  const suite = createVerificationSuite();
  const loader = documentLoader || createDocumentLoader();

  try {
    const result = await vc.verify({
      presentation,
      suite,
      challenge,
      domain,
      documentLoader: loader,
    });

    // Extract individual credential results
    const credentialResults = (result.credentialResults || []).map((cr: { verified: boolean; error?: { message: string } }) => ({
      verified: cr.verified,
      error: cr.error?.message,
    }));

    return {
      verified: result.verified,
      credentialResults,
      presentationResult: result.presentationResult ? {
        verified: result.presentationResult.verified,
        error: result.presentationResult.error?.message,
      } : undefined,
      error: result.error?.message,
    };
  } catch (error) {
    return {
      verified: false,
      credentialResults: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if a credential is expired.
 */
export function isCredentialExpired(credential: VerifiableCredential): boolean {
  if (!credential.validUntil) {
    return false;
  }
  const expirationDate = new Date(credential.validUntil);
  return expirationDate < new Date();
}

/**
 * Check if a credential is not yet valid.
 */
export function isCredentialNotYetValid(credential: VerifiableCredential): boolean {
  const validFromDate = new Date(credential.validFrom);
  return validFromDate > new Date();
}

/**
 * Extract credential types from a credential.
 */
export function getCredentialTypes(credential: VerifiableCredential): string[] {
  return credential.type.filter(t => t !== 'VerifiableCredential');
}
