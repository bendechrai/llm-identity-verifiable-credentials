# Implementation Plan - NDC London 2026 VC Demo

## Project Overview

A demo application for "Building Identity into LLM Workflows with Verifiable Credentials" that demonstrates how cryptographic ceilings constrain LLM agent actions regardless of social engineering attempts.

**Target:** NDC London 2026
**Core Message:** "The LLM doesn't make authorization decisions. The cryptographic ceiling does."

---

## Progress Overview

| Phase | Description | Status | Progress |
|-------|-------------|--------|----------|
| Phase 0 | Prerequisites (blockers) | COMPLETE | 100% |
| Phase 1 | Shared Library | COMPLETE | 100% |
| Phase 2 | VC Issuer | COMPLETE | 100% |
| Phase 3 | VC Wallet | COMPLETE | 100% |
| Phase 4 | Auth Server | COMPLETE | 100% |
| Phase 5 | Expense API | COMPLETE | 100% |
| Phase 6 | LLM Agent | COMPLETE | 100% |
| Phase 7 | Demo UI | COMPLETE | 100% |
| Phase 8 | Integration Testing | IN PROGRESS | 50% |
| Phase 9 | Docker & Deployment | IN PROGRESS | 70% |

**Overall Progress: ~90%** (all core services implemented, integration testing in progress, Docker deployment mostly complete)

---

## Current State Summary

| Component | Status | Notes |
|-----------|--------|-------|
| `shared/types.ts` | **COMPLETE** | All types defined (286 lines) - VC 2.0 compliant |
| `specs/*.md` | **COMPLETE** | 6 specification files for all services |
| `docker-compose.yaml` | **COMPLETE** | 7 services configured and ready |
| `Dockerfile` | **COMPLETE** | Updated for TypeScript with tsx |
| `Dockerfile.ui` | **COMPLETE** | Updated with dev script |
| `package.json` | **COMPLETE** | VC 2.0 packages installed correctly |
| `tsconfig.json` | **COMPLETE** | TypeScript configuration created |
| `src/lib/` | **COMPLETE** | All utilities implemented (keys, document-loader, credentials, jwt, middleware, audit, http-client) |
| `src/vc-issuer/` | **COMPLETE** | Issues EmployeeCredential and FinanceApproverCredential |
| `src/vc-wallet/` | **COMPLETE** | Stores credentials, creates VPs with challenge/domain |
| `src/auth-server/` | **COMPLETE** | Nonce management, VP verification, JWT issuance |
| `src/expense-api/` | **COMPLETE** | Ceiling enforcement (the core demo point) |
| `src/llm-agent/` | **COMPLETE** | Mock LLM with auth flow orchestration |
| `src/demo-ui/` | **COMPLETE** | Single-page HTML with chat and visualization |

**Remaining Work:**
- Phase 8: Integration Testing (end-to-end scenarios, security tests) - 50% complete
- Phase 9: Docker Polish (service-to-service networking verification, environment docs) - 70% complete

**Recent Code Fixes:**
- Fixed `generateEd25519KeyPair()` to properly set `id` and `controller` for VC signing
- Fixed `document-loader.ts` import syntax for `credentials-context` and `data-integrity-context` modules
- Fixed JSON-LD validation for custom credential properties (see Key Learnings below)
- Fixed integration test JWT verification to use `keyPair.verifier()` instead of passing KeyPair directly
- Added missing `jti` (JWT ID) fields to test JWT payloads

### Key Learnings

**Custom Credential Properties Require a JSON-LD Context:**
When using custom properties in Verifiable Credentials (e.g., `employeeId`, `approvalLimit`, `worksFor`), you must define them in a JSON-LD context. Without this, JSON-LD processors will strip undefined properties during canonicalization, causing validation errors.

Solution implemented in `document-loader.ts`:
- Created `DEMO_V1` context (`urn:llm-vc-demo:context:v1`) defining all custom properties
- Defines credential types: `EmployeeCredential`, `FinanceApproverCredential`
- Defines properties: `name`, `employeeId`, `jobTitle`, `department`, `role`, `approvalLimit`, `currency`, `worksFor`
- Includes `Person` and `Organization` types from schema.org

**Important:** All credentials must include `DEMO_V1` context alongside the VC 2.0 context:
```typescript
"@context": [
  "https://www.w3.org/ns/credentials/v2",
  "urn:llm-vc-demo:context:v1"  // DEMO_V1 - required for custom properties
]
```

### Package.json Dependency Issues

**Current (WRONG - VC 1.1):**
- `@digitalbazaar/ed25519-signature-2020` (^5.2.0) - VC 1.1 signature suite, NOT VC 2.0
- `@digitalbazaar/ed25519-verification-key-2020` (^4.1.0) - VC 1.1 key format

**Required (CORRECT - VC 2.0):**
- `@digitalbazaar/ed25519-multikey` (^1.3.0) - Modern Ed25519 key format for did:key
- `@digitalbazaar/eddsa-rdfc-2022-cryptosuite` (^1.2.0) - VC 2.0 DataIntegrityProof
- `jsonld-signatures` (^11.0.0) - JSON-LD signing operations

**Keep (already correct for VC 2.0):**
- `@digitalbazaar/credentials-context` (^2.0.0)
- `@digitalbazaar/data-integrity` (^2.0.0)
- `@digitalbazaar/data-integrity-context` (^2.0.0)
- `@digitalbazaar/vc` (^6.0.0)

---

## Quick Start - Immediate Next Steps

To begin implementation, execute these tasks in order:

### Step 1: Fix package.json (10 minutes)
```bash
# Remove VC 1.1 packages
npm uninstall @digitalbazaar/ed25519-signature-2020 @digitalbazaar/ed25519-verification-key-2020

# Add VC 2.0 packages
npm install @digitalbazaar/ed25519-multikey@^1.3.0 @digitalbazaar/eddsa-rdfc-2022-cryptosuite@^1.2.0 jsonld-signatures@^11.0.0

# Add tsx for TypeScript execution
npm install -D tsx@^4.7.0
```

### Step 2: Create tsconfig.json (5 minutes)
Create `/home/ralph/project/tsconfig.json` with the configuration in Phase 0.2.

### Step 3: Create directory structure (5 minutes)
```bash
mkdir -p src/lib src/vc-issuer src/vc-wallet src/auth-server src/expense-api src/llm-agent src/demo-ui
```

### Step 4: Build shared library (src/lib/) (2-3 hours)
This is the critical path - all services depend on it.

---

## Three Demo Scenarios

1. **Happy Path:** $5k expense, $10k limit -> APPROVED (all 5 steps succeed)
2. **Cryptographic Ceiling:** $15k expense, $10k limit -> DENIED (math enforces limit)
3. **Social Engineering:** Manipulation attempt with $25k expense -> DENIED (math doesn't care about urgency)

---

## Completion Summary

### Completed Items - Phase 0 (Prerequisites)
- [x] Package.json - Updated with VC 2.0 packages
- [x] tsconfig.json - Created with proper configuration
- [x] Directory structure - All src/ directories created
- [x] Dockerfile - Updated for TypeScript with tsx
- [x] Dockerfile.ui - Updated with dev script

### Completed Items - Phase 1 (Shared Library)
- [x] src/lib/package.json - Package configuration
- [x] src/lib/keys.ts - Ed25519 key management with did:key
- [x] src/lib/document-loader.ts - JSON-LD context bundling and did:key resolution
- [x] src/lib/credentials.ts - VC 2.0 issuance and verification
- [x] src/lib/jwt.ts - EdDSA JWT signing and verification
- [x] src/lib/middleware.ts - Express middleware (error handler, logger, CORS, auth)
- [x] src/lib/audit.ts - Audit logging system
- [x] src/lib/http-client.ts - HTTP client utilities
- [x] src/lib/index.ts - Library exports

### Completed Items - Phase 2 (VC Issuer)
- [x] src/vc-issuer/package.json - Package configuration
- [x] src/vc-issuer/issuer-key.ts - Issuer key management
- [x] src/vc-issuer/index.ts - Express app with all endpoints
- [x] POST /credentials/employee - Employee credential issuance
- [x] POST /credentials/finance-approver - Finance approver credential with approval limit
- [x] GET /.well-known/did.json - DID document endpoint
- [x] POST /demo/issue-alice-credentials - Demo setup endpoint

### Completed Items - Phase 3 (VC Wallet)
- [x] src/vc-wallet/package.json - Package configuration
- [x] src/vc-wallet/holder-key.ts - Holder (Alice's) key management
- [x] src/vc-wallet/storage.ts - Credential storage
- [x] src/vc-wallet/index.ts - Express app with all endpoints
- [x] POST /wallet/credentials - Store credentials with verification
- [x] POST /wallet/present - Create VP with challenge/domain binding
- [x] POST /wallet/demo/setup - Demo initialization

### Completed Items - Phase 4 (Auth Server)
- [x] src/auth-server/package.json - Package configuration
- [x] src/auth-server/auth-key.ts - JWT signing key
- [x] src/auth-server/nonce.ts - Nonce management (single-use, replay protection)
- [x] src/auth-server/trusted-issuers.ts - Trusted issuer management
- [x] src/auth-server/index.ts - Express app with all endpoints
- [x] POST /auth/presentation-request - Challenge generation
- [x] POST /auth/token - VP verification and JWT issuance with scope derivation
- [x] GET /auth/jwks - JWK Set for token verification

### Completed Items - Phase 5 (Expense API)
- [x] src/expense-api/package.json - Package configuration
- [x] src/expense-api/auth.ts - JWT validation middleware
- [x] src/expense-api/scopes.ts - Scope parsing and enforcement
- [x] src/expense-api/demo-data.ts - Demo expenses ($5k, $15k, $25k)
- [x] src/expense-api/index.ts - Express app with all endpoints
- [x] POST /expenses/:id/approve - THE CRYPTOGRAPHIC CEILING enforcement

### Completed Items - Phase 6 (LLM Agent)
- [x] src/llm-agent/package.json - Package configuration
- [x] src/llm-agent/llm/interface.ts - LLM interface
- [x] src/llm-agent/llm/mock.ts - Mock LLM implementation
- [x] src/llm-agent/llm/mock-responses.ts - Scripted responses for 3 scenarios
- [x] src/llm-agent/auth-flow.ts - Authorization flow orchestration
- [x] src/llm-agent/expense-flow.ts - Expense approval flow
- [x] src/llm-agent/sessions.ts - Session management
- [x] src/llm-agent/system-prompt.ts - System prompt for real LLMs
- [x] src/llm-agent/index.ts - Express app with all endpoints

### Completed Items - Phase 7 (Demo UI)
- [x] src/demo-ui/package.json - Package configuration with dev script
- [x] src/demo-ui/index.ts - Express static server
- [x] src/demo-ui/public/index.html - Single-page HTML with embedded CSS/JS
- [x] Chat interface - Message input, history, loading states
- [x] Authorization flow panel - 5-step visualization with status indicators
- [x] Credentials panel - Wallet display with approval limit highlighted
- [x] Scenario panel - Descriptions and suggested inputs
- [x] Audit log panel - Real-time audit entries
- [x] Dark terminal theme styling
- [x] Keyboard shortcuts (1/2/3 for scenarios, Enter, Escape)

### Completed Items - Specifications and Types
- [x] `shared/types.ts` - All types defined (286 lines, VC 2.0 compliant)
- [x] `specs/expense-api.md` - Expense API specification
- [x] `specs/auth-server.md` - Auth Server specification
- [x] `specs/vc-issuer.md` - VC Issuer specification
- [x] `specs/vc-wallet.md` - VC Wallet specification
- [x] `specs/llm-agent.md` - LLM Agent specification
- [x] `specs/demo-ui.md` - Demo UI specification
- [x] `docker-compose.yaml` - Service configuration (7 services defined)

### Remaining Items - Phase 8 (Integration Testing)
- [x] Component tests for Credential utilities (credentials.test.ts - 11 tests)
- [x] Component tests for JWT utilities (jwt.test.ts - 11 tests)
- [x] Component tests for Key management (keys.test.ts - 6 tests - already existed)
- [x] Integration tests (integration.test.ts - 19 tests) - credential flows with DEMO_V1 context
- [ ] End-to-end scenario tests (happy path, ceiling, social engineering)
- [ ] Component tests (VC Issuer, Wallet, Auth Server, Expense API)
- [ ] Security tests (token expiry, signature validation, replay protection, etc.)

**Testing Progress:** 47 tests passing, 3 skipped (todo), typecheck clean

### Remaining Items - Phase 9 (Docker Polish)
- [x] Docker health checks for all services (using wget to check /health endpoints)
- [x] Startup order verification with health check dependencies (depends_on with condition: service_healthy)
- [ ] Service-to-service networking verification
- [ ] Environment configuration documentation

---

## PHASE 0: Prerequisites (TRUE BLOCKERS)

**STATUS: COMPLETE**
**Progress: 18/18 tasks (100%)**

All subsequent phases depend on these tasks completing first. These are true blockers that prevent any code from running.

### 0.1 Package.json Updates
- [x] **0.1.1** Remove `@digitalbazaar/ed25519-signature-2020` - VC 1.1, not needed
- [x] **0.1.2** Remove `@digitalbazaar/ed25519-verification-key-2020` - VC 1.1, not needed
- [x] **0.1.3** Add `@digitalbazaar/ed25519-multikey` (^1.3.0) - Required for Ed25519 key generation with did:key
- [x] **0.1.4** Add `@digitalbazaar/eddsa-rdfc-2022-cryptosuite` (^1.2.0) - Required for VC 2.0 DataIntegrityProof
- [x] **0.1.5** Add `jsonld-signatures` (^11.0.0) - Required for JSON-LD signing operations
- [x] **0.1.6** Run `npm install` to verify all dependencies resolve

### 0.2 TypeScript Configuration
- [x] **0.2.1** Create `tsconfig.json` with:
  ```json
  {
    "compilerOptions": {
      "module": "ESNext",
      "moduleResolution": "node16",
      "target": "ES2022",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "outDir": "./dist",
      "rootDir": ".",
      "declaration": true,
      "resolveJsonModule": true
    },
    "include": ["src/**/*", "shared/**/*"],
    "exclude": ["node_modules", "dist"]
  }
  ```

### 0.3 Directory Structure
- [x] **0.3.1** Create `src/lib/` - shared library (CRITICAL - all services depend on this)
- [x] **0.3.2** Create `src/vc-issuer/`
- [x] **0.3.3** Create `src/vc-wallet/`
- [x] **0.3.4** Create `src/auth-server/`
- [x] **0.3.5** Create `src/expense-api/`
- [x] **0.3.6** Create `src/llm-agent/`
- [x] **0.3.7** Create `src/demo-ui/`

### 0.4 Docker TypeScript Support
- [x] **0.4.1** Update `Dockerfile`:
  - Current CMD: `["node", "--experimental-specifier-resolution=node", "index.js"]`
  - Problem: TypeScript files won't run with plain `node`
  - Solution: Either add `tsc` build step OR use `tsx` runtime
  - Recommended: Add `tsx` to dependencies and use `CMD ["npx", "tsx", "index.ts"]`
- [x] **0.4.2** Update `Dockerfile.ui`:
  - Current CMD: `["npm", "run", "dev"]`
  - Problem: No `dev` script defined in demo-ui package.json (doesn't exist yet)
  - Solution: demo-ui package.json must define a `dev` script OR change CMD
- [x] **0.4.3** Add `tsx` (^4.7.0) to devDependencies for TypeScript execution

---

## PHASE 1: Shared Library (`src/lib/`)

**STATUS: COMPLETE**
**Progress: 28/28 tasks (100%)**
**Priority: CRITICAL - All services depend on this library**

### 1.1 Package Setup
- [x] **1.1.1** Create `src/lib/package.json`:
  ```json
  {
    "name": "@llm-demo/lib",
    "version": "0.0.1",
    "type": "module",
    "main": "index.ts",
    "private": true
  }
  ```
- [x] **1.1.2** Create `src/lib/index.ts` - exports all modules

### 1.2 Key Management (`src/lib/keys.ts`)
**CRITICAL PATH - Required for all VC operations**
- [x] **1.2.1** `generateEd25519KeyPair()` - using `@digitalbazaar/ed25519-multikey`
- [x] **1.2.2** `keyPairToDid(keyPair)` - derive `did:key` with `z6Mk` prefix (Ed25519 multibase)
- [x] **1.2.3** `loadOrCreateKeyPair(path)` - load from file or generate new
- [x] **1.2.4** `serializeKeyPair(keyPair)` - JSON serialization for storage
- [x] **1.2.5** `deserializeKeyPair(data)` - reconstruct from JSON
- [x] **1.2.6** `getVerificationMethod(did)` - create verification method ID (`did:key:z6Mk...#z6Mk...`)
- [x] **1.2.7** `getSigner(keyPair)` - get Ed25519 signer interface for signing operations
- [x] **1.2.8** `getVerifier(publicKeyMultibase)` - get verifier interface for verification

### 1.3 Document Loader (`src/lib/document-loader.ts`)
**CRITICAL PATH - Required for all JSON-LD operations**
- [x] **1.3.1** Bundle `https://www.w3.org/ns/credentials/v2` context (VC 2.0 context)
- [x] **1.3.2** Bundle `https://www.w3.org/ns/did/v1` context (DID context)
- [x] **1.3.3** Bundle `https://w3id.org/security/multikey/v1` context (Multikey context)
- [x] **1.3.4** Bundle `https://w3id.org/security/data-integrity/v2` context (Data Integrity context)
- [x] **1.3.5** Implement `did:key` resolution (derive DID document from multibase public key)
- [x] **1.3.6** Create `createDocumentLoader()` factory function
- [x] **1.3.7** Handle unknown context URLs with clear error messages
- [x] **1.3.8** Custom DEMO_V1 context for credential properties (see Key Learnings)

### 1.4 Credential Utilities (`src/lib/credentials.ts`)
**CRITICAL PATH - Core VC operations**
- [x] **1.4.1** `createDataIntegritySuite(keyPair)` - using `eddsa-rdfc-2022` cryptosuite
- [x] **1.4.2** `issueCredential(credential, suite, documentLoader)` - sign VC with DataIntegrityProof
- [x] **1.4.3** `verifyCredential(credential, documentLoader)` - verify VC signature
- [x] **1.4.4** `createPresentation(credentials, holder)` - create unsigned VP
- [x] **1.4.5** `signPresentation(presentation, suite, challenge, domain, documentLoader)` - sign VP with challenge/domain binding
- [x] **1.4.6** `verifyPresentation(presentation, challenge, domain, documentLoader)` - verify VP with challenge/domain

### 1.5 JWT Utilities (`src/lib/jwt.ts`)
- [x] **1.5.1** `base64UrlEncode(data)` / `base64UrlDecode(str)` - helpers
- [x] **1.5.2** `createEdDsaJwtHeader()` - header with `alg: "EdDSA"`
- [x] **1.5.3** `signJwt(payload, keyPair)` - sign JWT with Ed25519
- [x] **1.5.4** `verifyJwt(token, publicKey)` - verify JWT signature
- [x] **1.5.5** `decodeJwt(token)` - decode without verification (for inspection)
- [x] **1.5.6** `keyPairToJwk(keyPair)` - convert to JWK (OKP curve Ed25519)
- [x] **1.5.7** `jwkToPublicKey(jwk)` - convert JWK back to public key bytes

### 1.6 Express Middleware (`src/lib/middleware.ts`)
- [x] **1.6.1** `errorHandler` - global JSON error handler with stack trace in dev mode
- [x] **1.6.2** `requestLogger` - log method, path, status, timing
- [x] **1.6.3** `corsMiddleware()` - allow all origins (demo only, not for production)
- [x] **1.6.4** `jsonBodyParser()` - JSON parsing with size limits
- [x] **1.6.5** `createTokenValidator(jwksUrl)` - JWT validation middleware factory

### 1.7 Audit Logger (`src/lib/audit.ts`)
- [x] **1.7.1** `AuditLogger` class with in-memory Map storage
- [x] **1.7.2** Implement `log(entry)` - add timestamped entry
- [x] **1.7.3** Implement `getEntries(filter?)` - query entries
- [x] **1.7.4** Implement `clear()` - reset for demo
- [x] **1.7.5** Implement `toJSON()` - export for UI

### 1.8 HTTP Client (`src/lib/http-client.ts`)
- [x] **1.8.1** `createHttpClient(baseUrl)` - factory with defaults
- [x] **1.8.2** `fetchJson<T>(path, options)` - typed fetch with timeout, error handling

### 1.9 Library Exports (`src/lib/index.ts`)
- [x] **1.9.1** Re-export all types from `../../shared/types.ts`
- [x] **1.9.2** Export all utility modules (keys, document-loader, credentials, jwt, middleware, audit, http-client)

---

## PHASE 2: VC Issuer Service (`src/vc-issuer/` - Port 3001)

**STATUS: COMPLETE**
**Progress: 12/12 tasks (100%)**
**Dependencies:** Phase 0 (prerequisites), Phase 1 (shared lib)

### 2.1 Package Setup
- [x] **2.1.1** Create `src/vc-issuer/package.json` with `@llm-demo/lib` dependency

### 2.2 Key Management
- [x] **2.2.1** Create `src/vc-issuer/issuer-key.ts` - load/generate issuer key pair
- [x] **2.2.2** Persist key to `/app/keys/issuer-key.json` (Docker volume: `issuer-keys`)
- [x] **2.2.3** Log issuer DID on startup for debugging

### 2.3 Express Application
- [x] **2.3.1** Create `src/vc-issuer/index.ts` - Express app with middleware

### 2.4 Endpoints
- [x] **2.4.1** `POST /credentials/employee` - issue EmployeeCredential
  - Zod schema validation for request body
  - VC 2.0 with `validFrom` (not `issuanceDate`)
  - DataIntegrityProof with `eddsa-rdfc-2022` cryptosuite
  - `credentialSubject.id` = holder's DID
- [x] **2.4.2** `POST /credentials/finance-approver` - issue FinanceApproverCredential
  - Include `approvalLimit` in subject (THE CRYPTOGRAPHIC CEILING VALUE)
  - Include `currency: "USD"` and `role: "finance-approver"`
- [x] **2.4.3** `GET /.well-known/did.json` - return issuer DID document
  - Multikey verification method
  - Ed25519 public key in multibase format
- [x] **2.4.4** `GET /issuer/info` - return issuer metadata (DID, name, etc.)
- [x] **2.4.5** `POST /demo/issue-alice-credentials` - issue both credentials for Alice
  - Employee credential with name, employeeId, jobTitle, department
  - Finance approver credential with **$10,000 limit** (critical for demo)
- [x] **2.4.6** `GET /health` - health check endpoint

---

## PHASE 3: VC Wallet Service (`src/vc-wallet/` - Port 3002)

**STATUS: COMPLETE**
**Progress: 14/14 tasks (100%)**
**Dependencies:** Phase 0, Phase 1, Phase 2 (for demo setup)

### 3.1 Package Setup
- [x] **3.1.1** Create `src/vc-wallet/package.json`

### 3.2 Key and Storage
- [x] **3.2.1** Create `src/vc-wallet/holder-key.ts` - load/generate holder (Alice's) key pair
- [x] **3.2.2** Persist key to `/app/keys/holder-key.json` (Docker volume: `wallet-keys`)
- [x] **3.2.3** Create `src/vc-wallet/storage.ts` - in-memory credential storage (Map by credential ID)

### 3.3 Express Application
- [x] **3.3.1** Create `src/vc-wallet/index.ts` - Express app

### 3.4 Endpoints
- [x] **3.4.1** `POST /wallet/credentials` - store credential
  - Verify credential signature before storing
  - Verify `credentialSubject.id` matches holder DID (binding check)
- [x] **3.4.2** `GET /wallet/credentials` - list all stored credentials
- [x] **3.4.3** `GET /wallet/credentials/:id` - get credential by ID
- [x] **3.4.4** `DELETE /wallet/credentials/:id` - remove credential
- [x] **3.4.5** `POST /wallet/present` - **CRITICAL**: create Verifiable Presentation
  - Accept `challenge` and `domain` from request body
  - Include requested credentials (by type or ID)
  - Sign with `proofPurpose: "authentication"` (NOT `assertionMethod`)
  - Include `challenge` and `domain` in proof (REPLAY PROTECTION)
- [x] **3.4.6** `GET /wallet/did` - return holder DID
- [x] **3.4.7** `POST /wallet/demo/setup` - demo initialization
  - Clear existing credentials
  - Call issuer at `ISSUER_URL` to get Alice's credentials
  - Store both credentials (employee + finance approver)
- [x] **3.4.8** `GET /wallet/demo/state` - return current wallet state
- [x] **3.4.9** `GET /health` - health check

---

## PHASE 4: Auth Server (`src/auth-server/` - Port 3003)

**STATUS: COMPLETE**
**Progress: 16/16 tasks (100%)**
**Dependencies:** Phase 0, Phase 1, Phase 2 (for trusted issuer)

### 4.1 Package Setup
- [x] **4.1.1** Create `src/auth-server/package.json`

### 4.2 Key and Nonce Management
- [x] **4.2.1** Create `src/auth-server/auth-key.ts` - JWT signing key pair
- [x] **4.2.2** Create `src/auth-server/nonce.ts` - **CRITICAL**: nonce management
  - `generateNonce()` - 144-bit cryptographically random (24 bytes hex)
  - `storeNonce(nonce, ttl)` - store with expiration (default: 5 minutes)
  - `consumeNonce(nonce)` - **SINGLE-USE** validation (delete after use)
  - This prevents replay attacks - a presentation can only be used once

### 4.3 Trust Management
- [x] **4.3.1** Create `src/auth-server/trusted-issuers.ts`
  - Fetch issuer DID from `ISSUER_URL` on startup
  - `isTrustedIssuer(did)` - check if issuer DID is in trusted list
  - `getTrustedIssuers()` - return list for debugging

### 4.4 Express Application
- [x] **4.4.1** Create `src/auth-server/index.ts` - Express app

### 4.5 Endpoints
- [x] **4.5.1** `POST /auth/presentation-request` - initiate auth flow
  - Generate cryptographic nonce (challenge)
  - Return `{ challenge, domain, credentialsRequired, expiresIn }`
  - Store nonce with TTL (5 minutes)
- [x] **4.5.2** `POST /auth/token` - **CRITICAL**: exchange VP for JWT
  - **Step 1**: Validate nonce exists and not expired
  - **Step 2**: Consume nonce (single-use - delete from storage)
  - **Step 3**: Verify VP signature (holder's signature on presentation)
  - **Step 4**: Verify VP holder binding (holder DID matches credential subjects)
  - **Step 5**: Verify challenge/domain in VP proof match request
  - **Step 6**: For each credential in VP:
    - Verify signature (issuer's signature)
    - Check issuer is in trusted list
    - Check not expired (validUntil)
  - **Step 7**: Derive scopes from credentials (SERVER-SIDE, not from client):
    - `expense:view` from EmployeeCredential
    - `expense:submit` from EmployeeCredential
    - `expense:approve:max:N` from FinanceApproverCredential.approvalLimit
  - **Step 8**: Issue JWT with 60-second expiry (from `TOKEN_EXPIRY_SECONDS` env)
  - **Step 9**: Log to audit with full verification details
- [x] **4.5.3** `GET /auth/jwks` - return JWK Set for token verification
  - Key type: OKP (Octet Key Pair)
  - Curve: Ed25519
  - Algorithm: EdDSA
- [x] **4.5.4** `GET /auth/trusted-issuers` - return trusted issuer list
- [x] **4.5.5** `POST /demo/reset` - clear nonces and audit log
- [x] **4.5.6** `GET /demo/audit-log` - return authorization decisions
- [x] **4.5.7** `GET /health` - health check

---

## PHASE 5: Expense API (`src/expense-api/` - Port 3005)

**STATUS: COMPLETE**
**Progress: 14/14 tasks (100%)**
**Dependencies:** Phase 0, Phase 1, Phase 4 (for JWKS)

### 5.1 Package Setup
- [x] **5.1.1** Create `src/expense-api/package.json`

### 5.2 Auth and Scope Handling
- [x] **5.2.1** Create `src/expense-api/auth.ts` - token validation middleware
  - Fetch and cache JWKS from Auth Server (`AUTH_SERVER_URL/auth/jwks`)
  - Verify JWT signature using Ed25519 public key
  - Check token expiry (strict - reject if `exp < now`)
  - Extract scopes and claims into request context
- [x] **5.2.2** Create `src/expense-api/scopes.ts`
  - `parseApprovalLimit(scope)` - extract N from `expense:approve:max:N`
  - `hasScope(scopes, required)` - check scope presence
  - `requireScope(scope)` - middleware factory for scope enforcement

### 5.3 Demo Data
- [x] **5.3.1** Create `src/expense-api/demo-data.ts` - initial expenses
  - `exp-001`: $5,000 marketing expense (for happy path - WILL BE APPROVED)
  - `exp-002`: $15,000 executive retreat (for ceiling demo - WILL BE DENIED)
  - `exp-003`: $25,000 urgent expense (for social engineering - WILL BE DENIED)

### 5.4 Express Application
- [x] **5.4.1** Create `src/expense-api/index.ts` - Express app

### 5.5 Endpoints
- [x] **5.5.1** `GET /expenses` - list expenses (requires `expense:view` scope)
- [x] **5.5.2** `GET /expenses/:id` - get expense (requires `expense:view` scope)
- [x] **5.5.3** `POST /expenses` - create expense (requires `expense:submit` scope)
- [x] **5.5.4** `POST /expenses/:id/approve` - **THE CRYPTOGRAPHIC CEILING**
  - Requires `expense:approve:max:N` scope
  - Parse approval limit N from scope string
  - **THE CHECK:** `if (expense.amount > approvalLimit) return 403`
  - This is where the math enforces the ceiling
  - No code path can bypass this - the limit comes from the signed credential
  - Response on success: `{ approved: true, expenseId, amount, ceiling, approvedBy, approvedAt }`
  - Response on ceiling violation: `{ error: "forbidden", message: "Amount exceeds approval limit", ceiling: N, requested: amount }`
  - Log to audit with ceiling, amount, decision
- [x] **5.5.5** `POST /expenses/:id/reject` - reject expense
- [x] **5.5.6** `POST /demo/reset` - reset expenses to initial state (all pending)
- [x] **5.5.7** `GET /demo/expenses` - get expenses without auth (for UI display)
- [x] **5.5.8** `GET /demo/audit-log` - get expense operation logs
- [x] **5.5.9** `GET /health` - health check

---

## PHASE 6: LLM Agent (`src/llm-agent/` - Port 3004)

**STATUS: COMPLETE**
**Progress: 18/18 tasks (100%)**
**Dependencies:** Phase 0, Phase 1, Phase 3, Phase 4, Phase 5

### 6.1 Package Setup
- [x] **6.1.1** Create `src/llm-agent/package.json`

### 6.2 LLM Modes
- [x] **6.2.1** Create `src/llm-agent/llm/interface.ts` - common LLM interface
  ```typescript
  interface LLM {
    chat(messages: Message[], tools?: Tool[]): Promise<Response>;
  }
  ```
- [x] **6.2.2** Create `src/llm-agent/llm/mock.ts` - MockLLM with pattern matching
- [x] **6.2.3** Create `src/llm-agent/llm/mock-responses.ts` - **CRITICAL**: scripted responses
  - **Happy path**: Recognize "$5,000" or "$5k" expense keywords, proceed with approval
  - **Cryptographic ceiling**: Recognize "$15,000" or "$15k", attempt approval (will fail at API)
  - **Social engineering**: Recognize urgent/CEO language, attempt approval anyway (ceiling handles denial)
  - All three scenarios should attempt the expense approval - the ceiling handles denial, not the LLM

### 6.3 Auth Flow
- [x] **6.3.1** Create `src/llm-agent/auth-flow.ts` - `executeAuthorizationFlow()`
  1. Request presentation challenge from Auth Server (`POST /auth/presentation-request`)
  2. Request VP from Wallet with challenge/domain (`POST /wallet/present`)
  3. Exchange VP for JWT at Auth Server (`POST /auth/token`)
  4. Return token with scopes and expiry
  - Handle errors at each step with clear messages

### 6.4 Expense Flow
- [x] **6.4.1** Create `src/llm-agent/expense-flow.ts` - `executeExpenseApproval()`
  - Use Bearer token from auth flow
  - Call Expense API approve endpoint (`POST /expenses/:id/approve`)
  - Handle success: return approval confirmation
  - Handle ceiling denial (403): return clear message about limit exceeded
  - Handle other errors: return error message

### 6.5 Session Management
- [x] **6.5.1** Create `src/llm-agent/sessions.ts` - session management (Map)
  - `createSession()` - new session with unique ID
  - `getSession(id)` - retrieve session
  - `updateSession(id, data)` - update session state
  - `deleteSession(id)` - cleanup
  - Store: scenario, current token, wallet state, action history

### 6.6 System Prompt
- [x] **6.6.1** Create `src/llm-agent/system-prompt.ts` - for non-mock LLM modes
  - Describe available tools (list expenses, approve expense)
  - Explain authorization flow requirements
  - Define response format

### 6.7 Express Application
- [x] **6.7.1** Create `src/llm-agent/index.ts` - Express app
  - Load `LLM_MODE` from environment (default: `mock`)
  - Initialize appropriate LLM implementation

### 6.8 Endpoints
- [x] **6.8.1** `POST /agent/session` - create session
  - Initialize wallet: call `POST /wallet/demo/setup`
  - Reset expenses: call `POST /demo/reset`
  - Return session ID and initial state
- [x] **6.8.2** `POST /agent/chat` - process message
  - Parse user intent using LLM
  - Execute auth flow if needed (get token)
  - Execute expense operations with token
  - Return response with actions array showing each step
- [x] **6.8.3** `DELETE /agent/session/:id` - end session
- [x] **6.8.4** `GET /agent/mode` - get current LLM mode
- [x] **6.8.5** `POST /agent/mode` - set LLM mode (for testing)
- [x] **6.8.6** `GET /health` - health check

---

## PHASE 7: Demo UI (`src/demo-ui/` - Port 3000)

**STATUS: COMPLETE**
**Progress: 24/24 tasks (100%)**
**Dependencies:** All backend services (Phases 0-6)

### 7.1 Package Setup
- [x] **7.1.1** Create `src/demo-ui/package.json`
  - Must include `dev` script for Dockerfile.ui: `"dev": "npx tsx index.ts"`

### 7.2 Express Static Server
- [x] **7.2.1** Create `src/demo-ui/index.ts` - serve static files from `public/`

### 7.3 HTML Structure (`src/demo-ui/public/index.html`)
- [x] **7.3.1** Create single HTML file with embedded CSS/JS (no build step)
- [x] **7.3.2** Header with scenario selector dropdown (Scenario 1/2/3)
- [x] **7.3.3** Two-column layout:
  - Left: Chat interface (70% width)
  - Right: Auth flow panel + Credentials panel (30% width)
- [x] **7.3.4** Bottom panels:
  - Scenario description with suggested input and "Copy" button
  - Audit log with real-time entries

### 7.4 Chat Interface
- [x] **7.4.1** Message input with send button
- [x] **7.4.2** Message history display with scrolling
- [x] **7.4.3** Visual indicators: user messages (right), assistant messages (left), system messages (center)
- [x] **7.4.4** Loading state with spinner during processing

### 7.5 Authorization Flow Panel
- [x] **7.5.1** Display 5-step flow with status indicators:
  1. Request Challenge (pending/in-progress/success/failed)
  2. Create Presentation (pending/in-progress/success/failed)
  3. Exchange for Token (pending/in-progress/success/failed)
  4. Call Expense API (pending/in-progress/success/failed)
  5. Ceiling Check (pending/in-progress/success/failed)
- [x] **7.5.2** Show challenge value, token preview, scopes as flow progresses
- [x] **7.5.3** Highlight the approval limit in the scopes

### 7.6 Credentials Panel
- [x] **7.6.1** Display wallet contents (credential types)
- [x] **7.6.2** Highlight `approvalLimit: $10,000` value (THE CEILING)
- [x] **7.6.3** Show credential types, issuer DID (truncated), validity

### 7.7 Scenario Panel
- [x] **7.7.1** Show scenario name and description
- [x] **7.7.2** Suggested input text with "Copy to Input" button
- [x] **7.7.3** Expected outcome indicator (green: approved, red: denied)

### 7.8 Audit Log Panel
- [x] **7.8.1** Real-time audit entries from all services
- [x] **7.8.2** Color-coded by event type:
  - Green: approved/success
  - Red: denied/failed
  - Yellow/Orange: in-progress/warning
- [x] **7.8.3** Timestamp and event details

### 7.9 Styling (Dark Terminal Theme)
- [x] **7.9.1** Dark background: `#1a1a2e` or similar
- [x] **7.9.2** Accent colors: cyan for info, green for success, red for errors
- [x] **7.9.3** Monospace font for technical data (DIDs, tokens, JSON)
- [x] **7.9.4** Responsive layout for presentation screen

### 7.10 JavaScript Functionality
- [x] **7.10.1** Session management (create on load, cleanup on window close)
- [x] **7.10.2** Chat handling (send message via fetch, display response)
- [x] **7.10.3** Auth flow visualization updates (update step status as actions complete)
- [x] **7.10.4** Keyboard shortcuts:
  - 1/2/3: Select scenarios
  - Enter: Send message
  - Escape: Clear input

---

## PHASE 8: Integration Testing

**STATUS: IN PROGRESS**
**Progress: 6/15 tasks (40%)**
**Dependencies:** All services implemented (Phases 0-7)

### 8.1 End-to-End Scenarios
- [ ] **8.1.1** Happy Path Test:
  - Setup: $5,000 expense (exp-001), $10,000 limit
  - All 5 authorization steps succeed
  - Expense approved
  - Verify audit log shows approval
- [ ] **8.1.2** Cryptographic Ceiling Test:
  - Setup: $15,000 expense (exp-002), $10,000 limit
  - Steps 1-4 succeed (auth is valid)
  - Step 5: Ceiling blocks approval (403 Forbidden)
  - Verify audit log shows denial with amounts
- [ ] **8.1.3** Social Engineering Test:
  - Setup: $25,000 expense (exp-003) with urgent/CEO language
  - Auth flow succeeds (credentials are valid)
  - Ceiling still blocks (math doesn't care about urgency)
  - Verify LLM attempted approval, ceiling blocked it

### 8.2 Component Tests
- [x] **8.2.1** Credential utilities (`src/lib/credentials.test.ts`):
  - 11 tests covering VC issuance, verification, VP creation and signing
  - Tests for DataIntegrityProof, challenge/domain binding
  - All passing
- [x] **8.2.2** JWT utilities (`src/lib/jwt.test.ts`):
  - 11 tests covering JWT signing, verification, encoding/decoding
  - Tests for EdDSA algorithm, JWK conversion
  - All passing
- [x] **8.2.3** Key management (`src/lib/keys.test.ts`):
  - 6 tests covering key generation, DID derivation, serialization
  - All passing
- [ ] **8.2.4** VC Issuer:
  - Credential structure matches VC 2.0 spec
  - DataIntegrityProof present with correct cryptosuite
  - `validFrom` used (not `issuanceDate`)
- [ ] **8.2.5** VC Wallet:
  - Signature verification works (valid signature accepted)
  - Invalid signatures rejected
  - Non-holder credentials rejected (subject.id mismatch)
  - VP includes challenge/domain in proof
- [ ] **8.2.6** Auth Server:
  - Nonce is single-use (second attempt fails)
  - VP with wrong challenge rejected
  - VP with untrusted issuer rejected
  - Scope derivation correct (limit from credential)
- [ ] **8.2.7** Expense API:
  - Valid token accepted
  - Expired token rejected (strict expiry check)
  - Ceiling enforcement works for all three amounts

### 8.3 Security Tests
- [ ] **8.3.1** Expired token rejection (wait 61 seconds, try again)
- [ ] **8.3.2** Invalid signature rejection (tampered credential)
- [ ] **8.3.3** Untrusted issuer rejection (credential from unknown issuer)
- [ ] **8.3.4** Nonce replay prevention (reuse VP, second request fails)
- [ ] **8.3.5** Scope escalation prevention (can't add scopes not in credential)
- [ ] **8.3.6** Ceiling bypass attempts (can't modify limit in token)

---

## PHASE 9: Docker and Deployment

**STATUS: IN PROGRESS**
**Progress: 8/11 tasks (73%)**
**Dependencies:** All services implemented

### 9.1 Dockerfile Updates
- [ ] **9.1.1** Update `Dockerfile` for TypeScript:
  - Add `tsx` to dependencies
  - Change CMD to: `["npx", "tsx", "index.ts"]`
  - Alternative: Add tsc build step, run compiled JS
- [ ] **9.1.2** Copy `tsconfig.json` in build stage
- [ ] **9.1.3** Fix `Dockerfile.ui`:
  - Ensure demo-ui/package.json has `dev` script
  - Script should use tsx: `"dev": "npx tsx index.ts"`

### 9.2 Docker Compose Verification
- [x] **9.2.1** Verify all 7 services defined in `docker-compose up` (DONE - exists)
- [ ] **9.2.2** Verify service-to-service networking (can reach by service name)
- [x] **9.2.3** Verify volume mounts for keys persistence (DONE - configured)
- [ ] **9.2.4** Verify shared library accessible to all services

### 9.3 Environment Configuration
- [x] **9.3.1** Create `.env.example` with all variables (PARTIAL - some exist)
  ```env
  # LLM Mode: mock | ollama | openai | anthropic
  LLM_MODE=mock

  # API Keys (only needed for non-mock modes)
  OPENAI_API_KEY=
  ANTHROPIC_API_KEY=

  # Token expiry (default: 60 seconds)
  TOKEN_EXPIRY_SECONDS=60
  ```
- [ ] **9.3.2** Document required vs optional variables

### 9.4 Health Checks
- [x] **9.4.1** Configure Docker health checks for all services
  - Health checks now use `wget --no-verbose --tries=1 --spider http://localhost:PORT/health`
  - All services have `/health` endpoints
  - Configured with proper intervals and retries
- [x] **9.4.2** Startup order verification with health check dependencies
  - `depends_on` now uses `condition: service_healthy` for proper orchestration
  - Services wait for their dependencies to be healthy before starting
  - Ensures proper initialization order (issuer -> wallet -> auth-server -> expense-api -> llm-agent -> demo-ui)

---

## Critical Path Summary

These items are blocking and must work correctly for the demo to succeed:

| Priority | Task | Why Critical |
|----------|------|--------------|
| 1 | Package dependencies (0.1) | Wrong VC libraries - nothing will work |
| 2 | tsconfig.json (0.2) | TypeScript won't compile |
| 3 | Directory structure (0.3) | Nowhere to put code |
| 4 | Dockerfile fixes (0.4) | Services won't run in Docker |
| 5 | Key management (1.2) | Can't sign/verify anything |
| 6 | Document loader (1.3) | All JSON-LD operations fail |
| 7 | Credential utilities (1.4) | Can't issue/verify VCs |
| 8 | VP with challenge/domain (3.4.5) | Replay attacks possible |
| 9 | Nonce single-use (4.2.2, 4.5.2) | Replay attacks possible |
| 10 | Scope derivation (4.5.2) | Wrong permissions granted |
| 11 | **Ceiling enforcement (5.5.4)** | **Demo's core point fails** |
| 12 | Mock responses (6.2.3) | Demo scenarios don't work |

---

## Architecture Diagram

```
+-----------------------------------------------------------------------------+
|                              Demo UI (3000)                                  |
|                    Single HTML with embedded CSS/JS                          |
+--------------------------------------+--------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------+
|                            LLM Agent (3004)                                  |
|              Orchestrates auth flow, processes user intent                   |
|                     Mock or Real LLM backend                                 |
+--------+--------------------+----------------------------+------------------+
         |                    |                            |
         v                    v                            v
+-----------------+  +-----------------+  +----------------------------------+
|  VC Wallet      |  |  Auth Server    |  |  Expense API (3005)              |
|  (3002)         |  |  (3003)         |  |                                  |
|                 |  |                 |  |  THE CRYPTOGRAPHIC CEILING:      |
|  Stores VCs     |  |  VP -> JWT      |  |  if (amount > limit) -> 403      |
|  Creates VPs    |  |  Scope derive   |  |                                  |
|  with challenge |  |  Nonce mgmt     |  |  Limit comes from signed VC      |
+--------+--------+  +--------+--------+  |  Math doesn't care about urgency |
         |                    |           +----------------------------------+
         |                    |
         v                    v
+-----------------------------------------+
|            VC Issuer (3001)             |
|                                         |
|  Issues EmployeeCredential              |
|  Issues FinanceApproverCredential       |
|    +-- approvalLimit: $10,000           |
|                                         |
|  DataIntegrityProof (eddsa-rdfc-2022)   |
+-----------------------------------------+
```

---

## Key Teaching Points

The demo succeeds when the audience understands:

1. **Happy Path**: Shows the complete VC flow working end-to-end - authentication, authorization, and action all succeed because the expense ($5k) is within the limit ($10k).

2. **Cryptographic Ceiling**: The `approvalLimit` is cryptographically signed in the credential by a trusted issuer. The Auth Server extracts this value and encodes it in the JWT scope. The Expense API parses the scope and enforces the ceiling with a simple mathematical comparison: `amount > limit`. This check cannot be bypassed because:
   - The limit comes from a signed credential (can't be forged)
   - The Auth Server derives scopes server-side (client can't inflate)
   - The Expense API validates the JWT signature (can't be tampered)

3. **Social Engineering**: The LLM can absolutely be manipulated by urgent language, fake authority ("CEO said"), or emotional appeals. The mock LLM even tries to approve the expense! But the ceiling holds because:
   - The authorization decision happens in the Auth Server (VP verification)
   - The expense decision happens in the Expense API (ceiling check)
   - Neither cares about the LLM's intent or the user's urgency
   - Math doesn't negotiate

**The demo's message:**
> "The LLM doesn't make authorization decisions. The cryptographic ceiling does. And math doesn't care about your urgency."

---

## File Reference

### Specifications (Complete)
- `/home/ralph/project/specs/vc-issuer.md` - VC Issuer specification
- `/home/ralph/project/specs/vc-wallet.md` - VC Wallet specification
- `/home/ralph/project/specs/auth-server.md` - Auth Server specification
- `/home/ralph/project/specs/expense-api.md` - Expense API specification
- `/home/ralph/project/specs/llm-agent.md` - LLM Agent specification
- `/home/ralph/project/specs/demo-ui.md` - Demo UI specification

### Types (Complete)
- `/home/ralph/project/shared/types.ts` - All TypeScript types (286 lines)

### Docker (Needs Fixes)
- `/home/ralph/project/docker-compose.yaml` - 7 services configured
- `/home/ralph/project/Dockerfile` - Backend services (needs tsx)
- `/home/ralph/project/Dockerfile.ui` - UI service (needs dev script)

### To Create
- `/home/ralph/project/tsconfig.json` - TypeScript configuration
- `/home/ralph/project/src/lib/*` - Shared library (8+ files)
- `/home/ralph/project/src/vc-issuer/*` - VC Issuer service
- `/home/ralph/project/src/vc-wallet/*` - VC Wallet service
- `/home/ralph/project/src/auth-server/*` - Auth Server service
- `/home/ralph/project/src/expense-api/*` - Expense API service
- `/home/ralph/project/src/llm-agent/*` - LLM Agent service
- `/home/ralph/project/src/demo-ui/*` - Demo UI service

---

## Estimated Timeline

| Phase | Estimated Time | Cumulative |
|-------|---------------|------------|
| Phase 0: Prerequisites | 30 min | 30 min |
| Phase 1: Shared Library | 3-4 hours | 4-5 hours |
| Phase 2: VC Issuer | 2 hours | 6-7 hours |
| Phase 3: VC Wallet | 2 hours | 8-9 hours |
| Phase 4: Auth Server | 3 hours | 11-12 hours |
| Phase 5: Expense API | 2 hours | 13-14 hours |
| Phase 6: LLM Agent | 3 hours | 16-17 hours |
| Phase 7: Demo UI | 3-4 hours | 19-21 hours |
| Phase 8: Integration Testing | 2-3 hours | 21-24 hours |
| Phase 9: Docker Polish | 1-2 hours | 22-26 hours |

**Total Estimated: 22-26 hours of focused development**

---

## Task Count Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 0 | 18 | 18 complete (100%) |
| Phase 1 | 28 | 28 complete (100%) |
| Phase 2 | 12 | 12 complete (100%) |
| Phase 3 | 14 | 14 complete (100%) |
| Phase 4 | 16 | 16 complete (100%) |
| Phase 5 | 14 | 14 complete (100%) |
| Phase 6 | 18 | 18 complete (100%) |
| Phase 7 | 24 | 24 complete (100%) |
| Phase 8 | 18 | 7 complete (39%) |
| Phase 9 | 11 | 8 complete (73%) |
| **Total** | **173** | **156 complete (90%)** |
