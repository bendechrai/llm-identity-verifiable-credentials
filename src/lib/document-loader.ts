/**
 * Document Loader for JSON-LD Operations
 *
 * Resolves JSON-LD contexts and DID documents for VC operations.
 * Bundles common contexts locally to avoid network requests.
 * Implements did:key resolution to derive DID documents from public keys.
 */

import * as Ed25519Multikey from '@digitalbazaar/ed25519-multikey';
import * as credentialsContext from '@digitalbazaar/credentials-context';
import * as dataIntegrityContext from '@digitalbazaar/data-integrity-context';

// Type assertions for context modules (they expose Map with contexts)
const credentialsContexts = (credentialsContext as unknown as { contexts: Map<string, object> }).contexts;
const dataIntegrityContexts = (dataIntegrityContext as unknown as { contexts: Map<string, object> }).contexts;

// VC 2.0 context URL
const VC_CONTEXT_URL = 'https://www.w3.org/ns/credentials/v2';
const DID_CONTEXT_URL = 'https://www.w3.org/ns/did/v1';
const MULTIKEY_CONTEXT_URL = 'https://w3id.org/security/multikey/v1';
const DATA_INTEGRITY_CONTEXT_URL = 'https://w3id.org/security/data-integrity/v2';
// Custom context for demo credential properties
const DEMO_CONTEXT_URL = 'https://demo.example.com/credentials/v1';

// DID context definition
const DID_CONTEXT = {
  '@context': {
    '@protected': true,
    id: '@id',
    type: '@type',
    controller: {
      '@id': 'https://w3id.org/security#controller',
      '@type': '@id',
    },
    verificationMethod: {
      '@id': 'https://w3id.org/security#verificationMethod',
      '@type': '@id',
      '@container': '@set',
    },
    authentication: {
      '@id': 'https://w3id.org/security#authenticationMethod',
      '@type': '@id',
      '@container': '@set',
    },
    assertionMethod: {
      '@id': 'https://w3id.org/security#assertionMethod',
      '@type': '@id',
      '@container': '@set',
    },
  },
};

// Custom demo context definition - defines all custom credential properties
// This context allows JSON-LD to properly process our EmployeeCredential and FinanceApproverCredential
const DEMO_CONTEXT = {
  '@context': {
    '@protected': true,
    // Credential types
    EmployeeCredential: 'https://demo.example.com/credentials#EmployeeCredential',
    FinanceApproverCredential: 'https://demo.example.com/credentials#FinanceApproverCredential',
    // Person and Organization types (schema.org style)
    Person: 'https://schema.org/Person',
    Organization: 'https://schema.org/Organization',
    // Employee credential properties
    name: 'https://schema.org/name',
    employeeId: 'https://demo.example.com/credentials#employeeId',
    jobTitle: 'https://schema.org/jobTitle',
    department: 'https://demo.example.com/credentials#department',
    worksFor: {
      '@id': 'https://schema.org/worksFor',
      '@type': '@id',
    },
    // Finance approver credential properties
    role: 'https://demo.example.com/credentials#role',
    approvalLimit: {
      '@id': 'https://demo.example.com/credentials#approvalLimit',
      '@type': 'https://www.w3.org/2001/XMLSchema#integer',
    },
    currency: 'https://demo.example.com/credentials#currency',
  },
};

// Multikey context definition (for Ed25519 multikey format)
const MULTIKEY_CONTEXT = {
  '@context': {
    '@protected': true,
    id: '@id',
    type: '@type',
    Multikey: {
      '@id': 'https://w3id.org/security#Multikey',
      '@context': {
        '@protected': true,
        id: '@id',
        type: '@type',
        controller: {
          '@id': 'https://w3id.org/security#controller',
          '@type': '@id',
        },
        publicKeyMultibase: {
          '@id': 'https://w3id.org/security#publicKeyMultibase',
          '@type': 'https://w3id.org/security#multibase',
        },
        secretKeyMultibase: {
          '@id': 'https://w3id.org/security#secretKeyMultibase',
          '@type': 'https://w3id.org/security#multibase',
        },
      },
    },
    publicKeyMultibase: {
      '@id': 'https://w3id.org/security#publicKeyMultibase',
      '@type': 'https://w3id.org/security#multibase',
    },
  },
};

// Bundled contexts map
const BUNDLED_CONTEXTS: Record<string, object> = {
  [VC_CONTEXT_URL]: credentialsContexts.get(VC_CONTEXT_URL)!,
  [DID_CONTEXT_URL]: DID_CONTEXT,
  [MULTIKEY_CONTEXT_URL]: MULTIKEY_CONTEXT,
  [DATA_INTEGRITY_CONTEXT_URL]: dataIntegrityContexts.get(DATA_INTEGRITY_CONTEXT_URL)!,
  [DEMO_CONTEXT_URL]: DEMO_CONTEXT,
};

/**
 * Resolve a did:key to a DID document.
 * did:key encodes the public key directly, so we can derive the document
 * without any external resolution.
 */
async function resolveDidKey(did: string): Promise<object> {
  if (!did.startsWith('did:key:')) {
    throw new Error(`Invalid did:key: ${did}`);
  }

  const publicKeyMultibase = did.replace('did:key:', '');

  // Verify this is an Ed25519 multikey (z6Mk prefix)
  if (!publicKeyMultibase.startsWith('z6Mk')) {
    throw new Error(`Unsupported key type in did:key: ${publicKeyMultibase}`);
  }

  // Create verification method ID
  const verificationMethodId = `${did}#${publicKeyMultibase}`;

  // Generate the DID document
  const didDocument = {
    '@context': [
      DID_CONTEXT_URL,
      MULTIKEY_CONTEXT_URL,
    ],
    id: did,
    verificationMethod: [
      {
        id: verificationMethodId,
        type: 'Multikey',
        controller: did,
        publicKeyMultibase,
      },
    ],
    authentication: [verificationMethodId],
    assertionMethod: [verificationMethodId],
  };

  return didDocument;
}

/**
 * Resolve a verification method from a did:key.
 */
async function resolveVerificationMethod(verificationMethodId: string): Promise<object> {
  // Parse the verification method ID (did:key:z6Mk...#z6Mk...)
  const [did, fragment] = verificationMethodId.split('#');

  if (!did || !fragment) {
    throw new Error(`Invalid verification method ID: ${verificationMethodId}`);
  }

  const publicKeyMultibase = did.replace('did:key:', '');

  // Verify the fragment matches the public key
  if (fragment !== publicKeyMultibase) {
    throw new Error(`Verification method fragment mismatch: ${fragment} !== ${publicKeyMultibase}`);
  }

  return {
    '@context': MULTIKEY_CONTEXT_URL,
    id: verificationMethodId,
    type: 'Multikey',
    controller: did,
    publicKeyMultibase,
  };
}

export interface DocumentLoaderResult {
  contextUrl: string | null;
  documentUrl: string;
  document: object;
}

export type DocumentLoader = (url: string) => Promise<DocumentLoaderResult>;

/**
 * Create a document loader for JSON-LD operations.
 * Handles context resolution and did:key DID document resolution.
 */
export function createDocumentLoader(): DocumentLoader {
  return async (url: string): Promise<DocumentLoaderResult> => {
    // Check bundled contexts first
    if (BUNDLED_CONTEXTS[url]) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: BUNDLED_CONTEXTS[url],
      };
    }

    // Handle did:key resolution
    if (url.startsWith('did:key:')) {
      // Check if this is a verification method or a DID
      if (url.includes('#')) {
        const document = await resolveVerificationMethod(url);
        return {
          contextUrl: null,
          documentUrl: url,
          document,
        };
      } else {
        const document = await resolveDidKey(url);
        return {
          contextUrl: null,
          documentUrl: url,
          document,
        };
      }
    }

    // Unknown URL
    throw new Error(
      `Unable to load document: ${url}. ` +
      `Only bundled contexts (${Object.keys(BUNDLED_CONTEXTS).join(', ')}) ` +
      `and did:key DIDs are supported.`
    );
  };
}

// Export context URLs for use in credentials
export const CONTEXTS = {
  VC_V2: VC_CONTEXT_URL,
  DID_V1: DID_CONTEXT_URL,
  MULTIKEY_V1: MULTIKEY_CONTEXT_URL,
  DATA_INTEGRITY_V2: DATA_INTEGRITY_CONTEXT_URL,
  DEMO_V1: DEMO_CONTEXT_URL,
};
