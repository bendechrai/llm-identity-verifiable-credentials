# Authorization Server

## Overview

The Authorization Server is the trust boundary between the LLM Agent and protected resources. It verifies Verifiable Presentations, extracts claims, and issues short-lived, tightly-scoped access tokens. This service is intentionally separate from the Expense API to demonstrate that authorization decisions happen outside the LLM's influence.

**Port:** 3003

## Jobs to Be Done

1. Generate cryptographic nonces for presentation requests
2. Verify Verifiable Presentations (holder binding + credential proofs)
3. Check issuer trust and credential revocation status
4. Extract claims and map them to scoped access tokens
5. Issue short-lived (60-second) JWTs with explicit constraints
6. Track used nonces to prevent replay attacks
7. Log all authorization decisions for audit

## The Cryptographic Ceiling

This server enforces what the slides call the "cryptographic ceiling" — the upper bound of what the LLM can do, regardless of how it's manipulated. The LLM cannot:

- Generate its own nonces
- Forge Verifiable Presentations
- Modify credential claims
- Extend token scopes beyond what credentials authorize
- Bypass the 60-second token expiration

## API Endpoints

### POST /auth/presentation-request

Request a nonce and credential requirements for authorization.

Request:
```json
{
  "action": "expense:approve",
  "resource": "expense-api"
}
```

Processing:
1. Generate cryptographically random nonce (min 128 bits entropy)
2. Store nonce with session ID and timestamp
3. Return credential requirements and nonce

Response:
```json
{
  "presentationRequest": {
    "challenge": "n-0W8Jf2x9K4mB3vL1pQ6rT8",
    "domain": "auth.acme.corp",
    "credentialsRequired": [
      {
        "type": "EmployeeCredential",
        "purpose": "Verify employment status"
      },
      {
        "type": "FinanceApproverCredential",
        "purpose": "Verify approval authority"
      }
    ]
  },
  "expiresIn": 300
}
```

The `challenge` is the nonce. The `domain` binds the presentation to this auth server. `expiresIn` indicates how long the nonce is valid (5 minutes).

### POST /auth/token

Exchange a Verifiable Presentation for an access token.

Request:
```json
{
  "presentation": {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    "type": ["VerifiablePresentation"],
    "holder": "did:key:z6Mk...",
    "verifiableCredential": [
      { /* EmployeeCredential */ },
      { /* FinanceApproverCredential */ }
    ],
    "proof": {
      "type": "DataIntegrityProof",
      "cryptosuite": "eddsa-rdfc-2022",
      "challenge": "n-0W8Jf2x9K4mB3vL1pQ6rT8",
      "domain": "auth.acme.corp",
      "verificationMethod": "did:key:z6Mk...#key-1",
      "proofPurpose": "authentication",
      "created": "2026-01-21T10:30:00Z",
      "proofValue": "z58DAdFfa9..."
    }
  }
}
```

Processing:
1. **Verify nonce**: Check challenge exists, is unused, and not expired
2. **Verify domain**: Confirm domain matches this auth server
3. **Verify holder binding**: Validate presentation proof signature
4. **Verify credentials**: For each credential:
   - Validate issuer signature
   - Check issuer is in trusted list
   - Check not expired
   - Check revocation status (if applicable)
5. **Extract claims**: Pull relevant claims from credentials
6. **Apply policy**: Map claims to scopes (server-side, not LLM-influenced)
7. **Mark nonce used**: Prevent replay
8. **Issue token**: Create short-lived JWT

Response (success):
```json
{
  "access_token": "eyJhbG...",
  "token_type": "Bearer",
  "expires_in": 60,
  "scope": "expense:approve:max:10000",
  "claims": {
    "employee": true,
    "employeeId": "E-1234",
    "name": "Alice Chen",
    "approvalLimit": 10000,
    "department": "Finance"
  }
}
```

Response (invalid nonce):
```json
{
  "error": "invalid_request",
  "error_description": "Challenge is invalid, expired, or already used"
}
```

Response (verification failed):
```json
{
  "error": "invalid_grant",
  "error_description": "Presentation verification failed: holder binding invalid"
}
```

Response (untrusted issuer):
```json
{
  "error": "invalid_grant",
  "error_description": "Credential issuer not in trusted list"
}
```

### GET /auth/jwks

Return the public keys for token verification (used by Expense API).

Response:
```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "base64url-encoded-public-key",
      "kid": "auth-server-key-1",
      "use": "sig",
      "alg": "EdDSA"
    }
  ]
}
```

### GET /auth/trusted-issuers

Return the list of trusted credential issuers (for transparency).

Response:
```json
{
  "issuers": [
    {
      "did": "did:key:z6Mk...",
      "name": "Acme Corporation HR",
      "credentialTypes": ["EmployeeCredential", "FinanceApproverCredential"]
    }
  ]
}
```

## Claim-to-Scope Mapping

Scopes are derived from verified credential claims using server-side policy:

| Credential Type | Claim | Derived Scope |
|-----------------|-------|---------------|
| EmployeeCredential | `employee: true` | `expense:view`, `expense:submit` |
| FinanceApproverCredential | `approvalLimit: N` | `expense:approve:max:N` |

The scope `expense:approve:max:10000` means:
- `expense` — resource type
- `approve` — action
- `max` — constraint type
- `10000` — constraint value (dollars)

**Critical**: The `max` value comes directly from the verified credential claim. The LLM cannot request a higher value.

## JWT Structure

Issued tokens include:

```json
{
  "iss": "https://auth.acme.corp",
  "sub": "did:key:z6Mk...",
  "aud": "expense-api",
  "exp": 1737456660,
  "iat": 1737456600,
  "jti": "unique-token-id",
  "scope": "expense:approve:max:10000",
  "claims": {
    "employeeId": "E-1234",
    "name": "Alice Chen",
    "approvalLimit": 10000
  }
}
```

- `exp` is 60 seconds after `iat`
- `jti` enables single-use token tracking (optional additional security)
- `claims` includes the verified credential claims for audit purposes

## Nonce Management

Nonces prevent replay attacks:

```javascript
const nonceStore = new Map(); // In production: Redis or similar

function generateNonce() {
  const nonce = crypto.randomBytes(18).toString('base64url');
  nonceStore.set(nonce, {
    createdAt: Date.now(),
    used: false
  });
  return nonce;
}

function validateAndConsumeNonce(nonce) {
  const entry = nonceStore.get(nonce);
  if (!entry) return { valid: false, reason: 'unknown' };
  if (entry.used) return { valid: false, reason: 'already_used' };
  if (Date.now() - entry.createdAt > 300000) return { valid: false, reason: 'expired' };

  entry.used = true; // Mark as consumed
  return { valid: true };
}
```

## Audit Logging

Every authorization decision must be logged:

```json
{
  "timestamp": "2026-01-21T10:30:00Z",
  "event": "authorization_decision",
  "requestId": "uuid",
  "challenge": "n-0W8Jf2x9K4mB3vL1pQ6rT8",
  "holderDid": "did:key:z6Mk...",
  "presentationVerified": true,
  "credentials": [
    {
      "type": "EmployeeCredential",
      "issuer": "did:key:z6Mk...",
      "issuerTrusted": true,
      "signatureValid": true,
      "notExpired": true
    },
    {
      "type": "FinanceApproverCredential",
      "issuer": "did:key:z6Mk...",
      "issuerTrusted": true,
      "signatureValid": true,
      "notExpired": true,
      "claims": {
        "approvalLimit": 10000
      }
    }
  ],
  "scopesGranted": ["expense:approve:max:10000"],
  "tokenId": "jti-value",
  "tokenExpiresAt": "2026-01-21T10:31:00Z",
  "decision": "granted"
}
```

Failed attempts must also be logged:

```json
{
  "timestamp": "2026-01-21T10:35:00Z",
  "event": "authorization_decision",
  "requestId": "uuid",
  "challenge": "n-0W8Jf2x9K4mB3vL1pQ6rT8",
  "failureReason": "nonce_already_used",
  "decision": "denied"
}
```

## Implementation Requirements

1. Use Ed25519 key pair for signing JWTs
2. Key pair generated on first run and persisted
3. Use `@digitalbazaar/vc` for presentation verification
4. Use `@digitalbazaar/eddsa-rdfc-2022-cryptosuite` for proof verification
5. Nonce storage must handle concurrent requests safely
6. All endpoints must be idempotent where applicable

## Demo Support

### POST /demo/reset

Reset nonce store and any session state.

### GET /demo/audit-log

Retrieve recent authorization decisions for display during demo.

Response:
```json
{
  "entries": [
    { /* audit log entry */ }
  ]
}
```

## Acceptance Criteria

- [ ] Nonces are cryptographically random with sufficient entropy
- [ ] Nonces can only be used once
- [ ] Nonces expire after 5 minutes
- [ ] Presentation holder binding is verified (signature over challenge + domain)
- [ ] All credentials in presentation are verified (issuer signatures)
- [ ] Only trusted issuers are accepted
- [ ] Scopes are derived from claims, not requested
- [ ] Tokens expire in 60 seconds
- [ ] All decisions are audit logged with full context
- [ ] JWKS endpoint allows Expense API to verify tokens
