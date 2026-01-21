# Verifiable Credential Issuer Service

## Overview

The Issuer Service creates and signs Verifiable Credentials using the W3C VC Data Model 2.0. It acts as a trusted authority (e.g., an employer's HR department) that attests to claims about subjects (employees). For this demo, it issues two credential types that together establish an employee's identity and authorization level.

**Port:** 3001

## Jobs to Be Done

1. Issue EmployeeCredentials that prove employment
2. Issue FinanceApproverCredentials that attest to approval authority
3. Provide issuer DID document for credential verification
4. Use VC Data Model 2.0 with DataIntegrityProof

## VC Data Model 2.0

This service uses the current W3C standard (May 2025):

- **Context:** `https://www.w3.org/ns/credentials/v2`
- **Proof type:** `DataIntegrityProof`
- **Cryptosuite:** `eddsa-rdfc-2022`
- **DID method:** `did:key` (for demo simplicity)

## Credential Types

### EmployeeCredential

Attests that a subject is employed by the issuing organization.

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://schema.org/"
  ],
  "type": ["VerifiableCredential", "EmployeeCredential"],
  "issuer": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "validFrom": "2026-01-21T00:00:00Z",
  "credentialSubject": {
    "id": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
    "type": "Person",
    "name": "Alice Chen",
    "employeeId": "E-1234",
    "jobTitle": "Finance Manager",
    "department": "Finance",
    "worksFor": {
      "type": "Organization",
      "name": "Acme Corporation"
    }
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-rdfc-2022",
    "verificationMethod": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "proofPurpose": "assertionMethod",
    "created": "2026-01-21T10:00:00Z",
    "proofValue": "z58DAdFfa9SkqZMVPxAQp..."
  }
}
```

**Key fields:**
- `validFrom` replaces `issuanceDate` in VC 2.0
- `credentialSubject.id` is the holder's DID (enables holder binding)
- Proof uses `eddsa-rdfc-2022` cryptosuite

### FinanceApproverCredential

Attests to specific expense approval authority.

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2"
  ],
  "type": ["VerifiableCredential", "FinanceApproverCredential"],
  "issuer": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "validFrom": "2026-01-21T00:00:00Z",
  "credentialSubject": {
    "id": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
    "role": "finance-approver",
    "approvalLimit": 10000,
    "currency": "USD",
    "department": "Finance"
  },
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-rdfc-2022",
    "verificationMethod": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
    "proofPurpose": "assertionMethod",
    "created": "2026-01-21T10:00:00Z",
    "proofValue": "z58DAdFfa9SkqZMVPxAQp..."
  }
}
```

**Critical field:** `approvalLimit: 10000` — this becomes the cryptographic ceiling.

## API Endpoints

### POST /credentials/employee

Issue an EmployeeCredential.

Request:
```json
{
  "subjectDid": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
  "name": "Alice Chen",
  "employeeId": "E-1234",
  "jobTitle": "Finance Manager",
  "department": "Finance"
}
```

Response: Signed VerifiableCredential (full JSON-LD document)

### POST /credentials/finance-approver

Issue a FinanceApproverCredential.

Request:
```json
{
  "subjectDid": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
  "approvalLimit": 10000,
  "department": "Finance"
}
```

Response: Signed VerifiableCredential

### GET /.well-known/did.json

Returns the issuer's DID document for verification.

For `did:key`, the DID document is deterministically derived from the public key, but we expose this endpoint for convenience:

```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/multikey/v1"
  ],
  "id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "verificationMethod": [
    {
      "id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "type": "Multikey",
      "controller": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
      "publicKeyMultibase": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
    }
  ],
  "assertionMethod": [
    "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
  ],
  "authentication": [
    "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK#z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
  ]
}
```

### GET /issuer/info

Return issuer metadata (for demo UI).

```json
{
  "did": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "name": "Acme Corporation HR",
  "credentialTypesIssued": ["EmployeeCredential", "FinanceApproverCredential"]
}
```

## Implementation Requirements

### Key Management

1. Generate Ed25519 key pair on first startup
2. Persist key pair to disk (or environment variable)
3. Derive `did:key` from public key
4. Use private key for signing credentials

```javascript
import { generateKeyPair } from '@digitalbazaar/ed25519-multikey';

// Generate on first run
const keyPair = await generateKeyPair();

// The DID is derived from the public key
// did:key:z6Mk... where z6Mk indicates Ed25519
```

### Credential Signing

Use the Digital Bazaar VC 2.0 stack:

```javascript
import * as vc from '@digitalbazaar/vc';
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
import { cryptosuite as eddsaRdfc2022CryptoSuite } from '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';

const suite = new DataIntegrityProof({
  signer: keyPair.signer(),
  cryptosuite: eddsaRdfc2022CryptoSuite
});

const signedCredential = await vc.issue({
  credential,
  suite,
  documentLoader
});
```

### Document Loader

The document loader resolves contexts and DIDs:

```javascript
import { securityLoader } from '@digitalbazaar/security-document-loader';

const loader = securityLoader();
loader.addStatic('https://www.w3.org/ns/credentials/v2', credentialsV2Context);
// Add other contexts as needed
```

## Demo Support

### POST /demo/issue-alice-credentials

Convenience endpoint to issue both credentials for Alice in one call.

Response:
```json
{
  "employeeCredential": { /* signed VC */ },
  "financeApproverCredential": { /* signed VC */ },
  "holderDid": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH"
}
```

This endpoint is used by the wallet's demo setup.

## Acceptance Criteria

- [ ] Issuer generates and persists Ed25519 key pair on startup
- [ ] DID is correctly derived using did:key method
- [ ] EmployeeCredentials include all required fields from schema.org
- [ ] FinanceApproverCredentials include approvalLimit as integer
- [ ] All credentials use VC Data Model 2.0 context
- [ ] All credentials use DataIntegrityProof with eddsa-rdfc-2022
- [ ] Credentials include validFrom (not issuanceDate)
- [ ] DID document is accessible at well-known endpoint
- [ ] Credentials can be verified using @digitalbazaar/vc
