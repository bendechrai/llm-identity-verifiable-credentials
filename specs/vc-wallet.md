# Verifiable Credential Wallet Service

## Overview

The Wallet Service stores Verifiable Credentials and creates Verifiable Presentations on request. It holds the user's private key and is the only component that can create valid holder-bound presentations. The LLM Agent can request presentations, but cannot forge them — this is the foundation of the cryptographic ceiling.

**Port:** 3002

## Jobs to Be Done

1. Generate and securely store the holder's DID and key pair
2. Store credentials received from issuers
3. Create Verifiable Presentations with holder binding
4. Embed verifier-provided challenge and domain in presentations
5. Sign presentations with the holder's private key

## The Critical Security Property

**The wallet holds the private key. The LLM does not.**

When the LLM Agent requests a presentation, the wallet:
1. Receives a challenge (nonce) that came from the Auth Server
2. Creates a presentation containing the requested credentials
3. Signs it with the holder's private key, binding the challenge and domain

Even if an attacker extracts the resulting VP through prompt injection:
- The VP is bound to the specific challenge (single-use)
- The VP is bound to the specific domain (can't be replayed elsewhere)
- The VP expires with the challenge (5 minutes)

## API Endpoints

### POST /wallet/credentials

Store a new credential in the wallet.

Request:
```json
{
  "credential": {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    "type": ["VerifiableCredential", "EmployeeCredential"],
    "issuer": "did:key:z6Mk...",
    "credentialSubject": {
      "id": "did:key:z6Mk...",
      ...
    },
    "proof": { ... }
  }
}
```

Processing:
1. Verify credential signature (reject if invalid)
2. Verify `credentialSubject.id` matches wallet holder DID
3. Store credential with metadata

Response:
```json
{
  "id": "cred-uuid-001",
  "stored": true,
  "type": ["VerifiableCredential", "EmployeeCredential"]
}
```

### GET /wallet/credentials

List all credentials in the wallet.

Response:
```json
{
  "credentials": [
    {
      "id": "cred-uuid-001",
      "type": ["VerifiableCredential", "EmployeeCredential"],
      "issuer": "did:key:z6Mk...",
      "validFrom": "2026-01-21T00:00:00Z"
    },
    {
      "id": "cred-uuid-002",
      "type": ["VerifiableCredential", "FinanceApproverCredential"],
      "issuer": "did:key:z6Mk...",
      "validFrom": "2026-01-21T00:00:00Z"
    }
  ],
  "holder": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH"
}
```

### GET /wallet/credentials/:id

Get a specific credential by ID.

### DELETE /wallet/credentials/:id

Remove a credential from the wallet.

### POST /wallet/present

Create a Verifiable Presentation. This is the key endpoint.

**Critical:** The `challenge` and `domain` MUST come from the Auth Server (verifier). The wallet embeds them in the presentation proof, binding it to that specific authorization request.

Request:
```json
{
  "credentialTypes": ["EmployeeCredential", "FinanceApproverCredential"],
  "challenge": "n-0W8Jf2x9K4mB3vL1pQ6rT8",
  "domain": "auth.acme.corp"
}
```

**Note:** We use `credentialTypes` instead of `credentialIds` for convenience — the wallet selects matching credentials. In a production system, you might want more precise selection.

Processing:
1. Find credentials matching requested types
2. Create presentation wrapper
3. Sign with holder's private key, including challenge and domain in proof

Response:
```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "type": ["VerifiablePresentation"],
  "holder": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
  "verifiableCredential": [
    { /* EmployeeCredential */ },
    { /* FinanceApproverCredential */ }
  ],
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-rdfc-2022",
    "verificationMethod": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH#z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
    "challenge": "n-0W8Jf2x9K4mB3vL1pQ6rT8",
    "domain": "auth.acme.corp",
    "proofPurpose": "authentication",
    "created": "2026-01-21T10:30:00Z",
    "proofValue": "z4oey5q2M3XKaxup3tmzN4..."
  }
}
```

**Key points:**
- `holder` matches `credentialSubject.id` in the credentials
- `challenge` is the nonce from Auth Server
- `domain` is the Auth Server's identifier
- `proofPurpose` is `authentication` (not `assertionMethod`)
- The proof is over the entire presentation including challenge and domain

Response (missing credentials):
```json
{
  "error": "missing_credentials",
  "message": "No credentials found matching types: EmployeeCredential",
  "available": ["FinanceApproverCredential"]
}
```

### GET /wallet/did

Get the wallet holder's DID.

Response:
```json
{
  "did": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH"
}
```

## Presentation Creation Flow

```javascript
import * as vc from '@digitalbazaar/vc';
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
import { cryptosuite as eddsaRdfc2022CryptoSuite } from '@digitalbazaar/eddsa-rdfc-2022-cryptosuite';

async function createPresentation({ credentialTypes, challenge, domain }) {
  // 1. Find matching credentials
  const credentials = findCredentialsByType(credentialTypes);
  if (credentials.length === 0) {
    throw new Error('No matching credentials');
  }

  // 2. Create unsigned presentation
  const presentation = vc.createPresentation({
    verifiableCredential: credentials,
    holder: holderDid
  });

  // 3. Create proof suite with holder's key
  const suite = new DataIntegrityProof({
    signer: holderKeyPair.signer(),
    cryptosuite: eddsaRdfc2022CryptoSuite
  });

  // 4. Sign presentation with challenge and domain
  const signedPresentation = await vc.signPresentation({
    presentation,
    suite,
    challenge,  // From Auth Server
    domain,     // From Auth Server
    documentLoader
  });

  return signedPresentation;
}
```

## Why Challenge and Domain Matter

### Without challenge/domain binding:

1. Attacker extracts VP from LLM context
2. Attacker replays VP to Auth Server
3. Auth Server accepts it → Token issued to attacker

### With challenge/domain binding:

1. Attacker extracts VP from LLM context
2. Attacker tries to replay VP
3. Auth Server checks: "Did I issue challenge `abc123`? Is it unused?"
4. If already used: **Rejected**
5. If different Auth Server: Challenge unknown → **Rejected**

The VP is a single-use, domain-bound artifact.

## Implementation Requirements

### Key Management

1. Generate Ed25519 key pair on first startup
2. Persist key pair securely
3. Derive `did:key` from public key
4. Never expose private key outside wallet service

### Credential Storage

For the demo, in-memory storage is sufficient:

```javascript
const credentials = new Map(); // id -> credential

function storeCredential(credential) {
  const id = generateUUID();
  credentials.set(id, {
    id,
    credential,
    addedAt: new Date().toISOString()
  });
  return id;
}
```

### Credential Verification on Storage

Before storing a credential, verify:
1. The credential signature is valid
2. The `credentialSubject.id` matches the wallet holder's DID

```javascript
async function verifyAndStore(credential) {
  // Verify signature
  const result = await vc.verifyCredential({
    credential,
    suite: verificationSuite,
    documentLoader
  });

  if (!result.verified) {
    throw new Error('Invalid credential signature');
  }

  // Verify holder binding
  if (credential.credentialSubject.id !== holderDid) {
    throw new Error('Credential subject does not match wallet holder');
  }

  return storeCredential(credential);
}
```

## Demo Support

### POST /wallet/demo/setup

Configure wallet for a demo scenario.

Request:
```json
{
  "scenario": "happy-path"
}
```

**Scenarios:**

| Scenario | Credentials Loaded |
|----------|-------------------|
| `happy-path` | EmployeeCredential + FinanceApproverCredential ($10k limit) |
| `cryptographic-ceiling` | Same as happy-path (ceiling tested by expense amount) |
| `social-engineering` | Same as happy-path (social engineering tested by conversation) |

Processing:
1. Clear existing credentials
2. Request credentials from Issuer service (`/demo/issue-alice-credentials`)
3. Store received credentials
4. Return wallet state

Response:
```json
{
  "scenario": "happy-path",
  "holder": "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
  "credentials": [
    {
      "type": "EmployeeCredential",
      "claims": { "name": "Alice Chen", "employeeId": "E-1234" }
    },
    {
      "type": "FinanceApproverCredential",
      "claims": { "approvalLimit": 10000 }
    }
  ]
}
```

### GET /wallet/demo/state

Get current wallet state for demo UI.

## Acceptance Criteria

- [ ] Wallet generates and persists holder DID on startup
- [ ] Credentials are verified before storage (invalid signatures rejected)
- [ ] Only credentials for this holder can be stored
- [ ] Presentations include challenge and domain from request
- [ ] Presentations use DataIntegrityProof with eddsa-rdfc-2022
- [ ] Presentation proofPurpose is "authentication"
- [ ] Missing credentials return clear error with available types
- [ ] Demo scenarios can be set up with single API call
- [ ] Private key never leaves the wallet service
