# Implementation Plan - NDC London 2026 VC Demo

## Project Overview

A demo application for "Building Identity into LLM Workflows with Verifiable Credentials" that demonstrates how cryptographic ceilings constrain LLM agent actions regardless of social engineering attempts.

**Target:** NDC London 2026
**Core Message:** "The LLM doesn't make authorization decisions. The cryptographic ceiling does."

---

## Progress Overview

| Phase | Description | Status | Progress |
|-------|-------------|--------|----------|
| Phase 0 | Prerequisites (blockers) | NOT STARTED | 0% |
| Phase 1 | Shared Library | NOT STARTED | 0% |
| Phase 2 | VC Issuer | NOT STARTED | 0% |
| Phase 3 | VC Wallet | NOT STARTED | 0% |
| Phase 4 | Auth Server | NOT STARTED | 0% |
| Phase 5 | Expense API | NOT STARTED | 0% |
| Phase 6 | LLM Agent | NOT STARTED | 0% |
| Phase 7 | Demo UI | NOT STARTED | 0% |
| Phase 8 | Integration Testing | NOT STARTED | 0% |
| Phase 9 | Docker & Deployment | PARTIAL | 30% |

**Overall Progress: ~5%** (specs and types complete, no implementation)

---

## Current State Summary

| Component | Status | Notes |
|-----------|--------|-------|
| `shared/types.ts` | **COMPLETE** | All types defined (286 lines) - VC 2.0 compliant |
| `specs/*.md` | **COMPLETE** | 6 specification files for all services |
| `docker-compose.yaml` | **EXISTS** | 7 services configured (needs code to run) |
| `Dockerfile` | **NEEDS FIX** | Runs `node index.js`, needs TypeScript compilation/tsx |
| `Dockerfile.ui` | **NEEDS FIX** | Runs `npm run dev` but no dev script in demo-ui |
| `package.json` | **NEEDS FIX** | Has WRONG VC 1.1 dependencies, needs VC 2.0 packages |
| `tsconfig.json` | **MISSING** | CRITICAL - TypeScript won't compile without it |
| `src/` directory | **EMPTY** | Directory exists but contains no files - all services must be built |
| `src/lib/` | **MISSING** | Shared library must be created first |

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

### Completed Items
- [x] `shared/types.ts` - All types defined (286 lines, VC 2.0 compliant)
- [x] `specs/expense-api.md` - Expense API specification
- [x] `specs/auth-server.md` - Auth Server specification
- [x] `specs/vc-issuer.md` - VC Issuer specification
- [x] `specs/vc-wallet.md` - VC Wallet specification
- [x] `specs/llm-agent.md` - LLM Agent specification
- [x] `specs/demo-ui.md` - Demo UI specification
- [x] `docker-compose.yaml` - Service configuration (7 services defined)

### Items That Exist But Need Fixes
- [ ] `Dockerfile` - Exists but needs TypeScript compilation support
- [ ] `Dockerfile.ui` - Exists but needs fix for missing `dev` script
- [ ] `package.json` - Exists but needs dependency updates (VC 1.1 -> VC 2.0)

### Blocking Items to Create
1. **tsconfig.json**: CRITICAL - TypeScript cannot compile without this
2. **src/lib/**: Shared library - ALL services depend on this
3. **All service implementations**: src/ directory is completely empty

---

## PHASE 0: Prerequisites (TRUE BLOCKERS)

**STATUS: NOT STARTED**
**Progress: 0/18 tasks (0%)**

All subsequent phases depend on these tasks completing first. These are true blockers that prevent any code from running.

### 0.1 Package.json Updates
- [ ] **0.1.1** Remove `@digitalbazaar/ed25519-signature-2020` - VC 1.1, not needed
- [ ] **0.1.2** Remove `@digitalbazaar/ed25519-verification-key-2020` - VC 1.1, not needed
- [ ] **0.1.3** Add `@digitalbazaar/ed25519-multikey` (^1.3.0) - Required for Ed25519 key generation with did:key
- [ ] **0.1.4** Add `@digitalbazaar/eddsa-rdfc-2022-cryptosuite` (^1.2.0) - Required for VC 2.0 DataIntegrityProof
- [ ] **0.1.5** Add `jsonld-signatures` (^11.0.0) - Required for JSON-LD signing operations
- [ ] **0.1.6** Run `npm install` to verify all dependencies resolve

### 0.2 TypeScript Configuration
- [ ] **0.2.1** Create `tsconfig.json` with:
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
- [ ] **0.3.1** Create `src/lib/` - shared library (CRITICAL - all services depend on this)
- [ ] **0.3.2** Create `src/vc-issuer/`
- [ ] **0.3.3** Create `src/vc-wallet/`
- [ ] **0.3.4** Create `src/auth-server/`
- [ ] **0.3.5** Create `src/expense-api/`
- [ ] **0.3.6** Create `src/llm-agent/`
- [ ] **0.3.7** Create `src/demo-ui/`

### 0.4 Docker TypeScript Support
- [ ] **0.4.1** Update `Dockerfile`:
  - Current CMD: `["node", "--experimental-specifier-resolution=node", "index.js"]`
  - Problem: TypeScript files won't run with plain `node`
  - Solution: Either add `tsc` build step OR use `tsx` runtime
  - Recommended: Add `tsx` to dependencies and use `CMD ["npx", "tsx", "index.ts"]`
- [ ] **0.4.2** Update `Dockerfile.ui`:
  - Current CMD: `["npm", "run", "dev"]`
  - Problem: No `dev` script defined in demo-ui package.json (doesn't exist yet)
  - Solution: demo-ui package.json must define a `dev` script OR change CMD
- [ ] **0.4.3** Add `tsx` (^4.7.0) to devDependencies for TypeScript execution

---

## PHASE 1: Shared Library (`src/lib/`)

**STATUS: NOT STARTED**
**Progress: 0/27 tasks (0%)**
**Priority: CRITICAL - All services depend on this library**
**Blocked by: Phase 0 (prerequisites)**

### 1.1 Package Setup
- [ ] **1.1.1** Create `src/lib/package.json`:
  ```json
  {
    "name": "@llm-demo/lib",
    "version": "0.0.1",
    "type": "module",
    "main": "index.ts",
    "private": true
  }
  ```
- [ ] **1.1.2** Create `src/lib/index.ts` - exports all modules

### 1.2 Key Management (`src/lib/keys.ts`)
**CRITICAL PATH - Required for all VC operations**
- [ ] **1.2.1** `generateEd25519KeyPair()` - using `@digitalbazaar/ed25519-multikey`
- [ ] **1.2.2** `keyPairToDid(keyPair)` - derive `did:key` with `z6Mk` prefix (Ed25519 multibase)
- [ ] **1.2.3** `loadOrCreateKeyPair(path)` - load from file or generate new
- [ ] **1.2.4** `serializeKeyPair(keyPair)` - JSON serialization for storage
- [ ] **1.2.5** `deserializeKeyPair(data)` - reconstruct from JSON
- [ ] **1.2.6** `getVerificationMethod(did)` - create verification method ID (`did:key:z6Mk...#z6Mk...`)
- [ ] **1.2.7** `getSigner(keyPair)` - get Ed25519 signer interface for signing operations
- [ ] **1.2.8** `getVerifier(publicKeyMultibase)` - get verifier interface for verification

### 1.3 Document Loader (`src/lib/document-loader.ts`)
**CRITICAL PATH - Required for all JSON-LD operations**
- [ ] **1.3.1** Bundle `https://www.w3.org/ns/credentials/v2` context (VC 2.0 context)
- [ ] **1.3.2** Bundle `https://www.w3.org/ns/did/v1` context (DID context)
- [ ] **1.3.3** Bundle `https://w3id.org/security/multikey/v1` context (Multikey context)
- [ ] **1.3.4** Bundle `https://w3id.org/security/data-integrity/v2` context (Data Integrity context)
- [ ] **1.3.5** Implement `did:key` resolution (derive DID document from multibase public key)
- [ ] **1.3.6** Create `createDocumentLoader()` factory function
- [ ] **1.3.7** Handle unknown context URLs with clear error messages

### 1.4 Credential Utilities (`src/lib/credentials.ts`)
**CRITICAL PATH - Core VC operations**
- [ ] **1.4.1** `createDataIntegritySuite(keyPair)` - using `eddsa-rdfc-2022` cryptosuite
- [ ] **1.4.2** `issueCredential(credential, suite, documentLoader)` - sign VC with DataIntegrityProof
- [ ] **1.4.3** `verifyCredential(credential, documentLoader)` - verify VC signature
- [ ] **1.4.4** `createPresentation(credentials, holder)` - create unsigned VP
- [ ] **1.4.5** `signPresentation(presentation, suite, challenge, domain, documentLoader)` - sign VP with challenge/domain binding
- [ ] **1.4.6** `verifyPresentation(presentation, challenge, domain, documentLoader)` - verify VP with challenge/domain

### 1.5 JWT Utilities (`src/lib/jwt.ts`)
- [ ] **1.5.1** `base64UrlEncode(data)` / `base64UrlDecode(str)` - helpers
- [ ] **1.5.2** `createEdDsaJwtHeader()` - header with `alg: "EdDSA"`
- [ ] **1.5.3** `signJwt(payload, keyPair)` - sign JWT with Ed25519
- [ ] **1.5.4** `verifyJwt(token, publicKey)` - verify JWT signature
- [ ] **1.5.5** `decodeJwt(token)` - decode without verification (for inspection)
- [ ] **1.5.6** `keyPairToJwk(keyPair)` - convert to JWK (OKP curve Ed25519)
- [ ] **1.5.7** `jwkToPublicKey(jwk)` - convert JWK back to public key bytes

### 1.6 Express Middleware (`src/lib/middleware.ts`)
- [ ] **1.6.1** `errorHandler` - global JSON error handler with stack trace in dev mode
- [ ] **1.6.2** `requestLogger` - log method, path, status, timing
- [ ] **1.6.3** `corsMiddleware()` - allow all origins (demo only, not for production)
- [ ] **1.6.4** `jsonBodyParser()` - JSON parsing with size limits
- [ ] **1.6.5** `createTokenValidator(jwksUrl)` - JWT validation middleware factory

### 1.7 Audit Logger (`src/lib/audit.ts`)
- [ ] **1.7.1** `AuditLogger` class with in-memory Map storage
- [ ] **1.7.2** Implement `log(entry)` - add timestamped entry
- [ ] **1.7.3** Implement `getEntries(filter?)` - query entries
- [ ] **1.7.4** Implement `clear()` - reset for demo
- [ ] **1.7.5** Implement `toJSON()` - export for UI

### 1.8 HTTP Client (`src/lib/http-client.ts`)
- [ ] **1.8.1** `createHttpClient(baseUrl)` - factory with defaults
- [ ] **1.8.2** `fetchJson<T>(path, options)` - typed fetch with timeout, error handling

### 1.9 Library Exports (`src/lib/index.ts`)
- [ ] **1.9.1** Re-export all types from `../../shared/types.ts`
- [ ] **1.9.2** Export all utility modules (keys, document-loader, credentials, jwt, middleware, audit, http-client)

---

## PHASE 2: VC Issuer Service (`src/vc-issuer/` - Port 3001)

**STATUS: NOT STARTED**
**Progress: 0/12 tasks (0%)**
**Dependencies:** Phase 0 (prerequisites), Phase 1 (shared lib)

### 2.1 Package Setup
- [ ] **2.1.1** Create `src/vc-issuer/package.json` with `@llm-demo/lib` dependency

### 2.2 Key Management
- [ ] **2.2.1** Create `src/vc-issuer/issuer-key.ts` - load/generate issuer key pair
- [ ] **2.2.2** Persist key to `/app/keys/issuer-key.json` (Docker volume: `issuer-keys`)
- [ ] **2.2.3** Log issuer DID on startup for debugging

### 2.3 Express Application
- [ ] **2.3.1** Create `src/vc-issuer/index.ts` - Express app with middleware

### 2.4 Endpoints
- [ ] **2.4.1** `POST /credentials/employee` - issue EmployeeCredential
  - Zod schema validation for request body
  - VC 2.0 with `validFrom` (not `issuanceDate`)
  - DataIntegrityProof with `eddsa-rdfc-2022` cryptosuite
  - `credentialSubject.id` = holder's DID
- [ ] **2.4.2** `POST /credentials/finance-approver` - issue FinanceApproverCredential
  - Include `approvalLimit` in subject (THE CRYPTOGRAPHIC CEILING VALUE)
  - Include `currency: "USD"` and `role: "finance-approver"`
- [ ] **2.4.3** `GET /.well-known/did.json` - return issuer DID document
  - Multikey verification method
  - Ed25519 public key in multibase format
- [ ] **2.4.4** `GET /issuer/info` - return issuer metadata (DID, name, etc.)
- [ ] **2.4.5** `POST /demo/issue-alice-credentials` - issue both credentials for Alice
  - Employee credential with name, employeeId, jobTitle, department
  - Finance approver credential with **$10,000 limit** (critical for demo)
- [ ] **2.4.6** `GET /health` - health check endpoint

---

## PHASE 3: VC Wallet Service (`src/vc-wallet/` - Port 3002)

**STATUS: NOT STARTED**
**Progress: 0/14 tasks (0%)**
**Dependencies:** Phase 0, Phase 1, Phase 2 (for demo setup)

### 3.1 Package Setup
- [ ] **3.1.1** Create `src/vc-wallet/package.json`

### 3.2 Key and Storage
- [ ] **3.2.1** Create `src/vc-wallet/holder-key.ts` - load/generate holder (Alice's) key pair
- [ ] **3.2.2** Persist key to `/app/keys/holder-key.json` (Docker volume: `wallet-keys`)
- [ ] **3.2.3** Create `src/vc-wallet/storage.ts` - in-memory credential storage (Map by credential ID)

### 3.3 Express Application
- [ ] **3.3.1** Create `src/vc-wallet/index.ts` - Express app

### 3.4 Endpoints
- [ ] **3.4.1** `POST /wallet/credentials` - store credential
  - Verify credential signature before storing
  - Verify `credentialSubject.id` matches holder DID (binding check)
- [ ] **3.4.2** `GET /wallet/credentials` - list all stored credentials
- [ ] **3.4.3** `GET /wallet/credentials/:id` - get credential by ID
- [ ] **3.4.4** `DELETE /wallet/credentials/:id` - remove credential
- [ ] **3.4.5** `POST /wallet/present` - **CRITICAL**: create Verifiable Presentation
  - Accept `challenge` and `domain` from request body
  - Include requested credentials (by type or ID)
  - Sign with `proofPurpose: "authentication"` (NOT `assertionMethod`)
  - Include `challenge` and `domain` in proof (REPLAY PROTECTION)
- [ ] **3.4.6** `GET /wallet/did` - return holder DID
- [ ] **3.4.7** `POST /wallet/demo/setup` - demo initialization
  - Clear existing credentials
  - Call issuer at `ISSUER_URL` to get Alice's credentials
  - Store both credentials (employee + finance approver)
- [ ] **3.4.8** `GET /wallet/demo/state` - return current wallet state
- [ ] **3.4.9** `GET /health` - health check

---

## PHASE 4: Auth Server (`src/auth-server/` - Port 3003)

**STATUS: NOT STARTED**
**Progress: 0/16 tasks (0%)**
**Dependencies:** Phase 0, Phase 1, Phase 2 (for trusted issuer)

### 4.1 Package Setup
- [ ] **4.1.1** Create `src/auth-server/package.json`

### 4.2 Key and Nonce Management
- [ ] **4.2.1** Create `src/auth-server/auth-key.ts` - JWT signing key pair
- [ ] **4.2.2** Create `src/auth-server/nonce.ts` - **CRITICAL**: nonce management
  - `generateNonce()` - 144-bit cryptographically random (24 bytes hex)
  - `storeNonce(nonce, ttl)` - store with expiration (default: 5 minutes)
  - `consumeNonce(nonce)` - **SINGLE-USE** validation (delete after use)
  - This prevents replay attacks - a presentation can only be used once

### 4.3 Trust Management
- [ ] **4.3.1** Create `src/auth-server/trusted-issuers.ts`
  - Fetch issuer DID from `ISSUER_URL` on startup
  - `isTrustedIssuer(did)` - check if issuer DID is in trusted list
  - `getTrustedIssuers()` - return list for debugging

### 4.4 Express Application
- [ ] **4.4.1** Create `src/auth-server/index.ts` - Express app

### 4.5 Endpoints
- [ ] **4.5.1** `POST /auth/presentation-request` - initiate auth flow
  - Generate cryptographic nonce (challenge)
  - Return `{ challenge, domain, credentialsRequired, expiresIn }`
  - Store nonce with TTL (5 minutes)
- [ ] **4.5.2** `POST /auth/token` - **CRITICAL**: exchange VP for JWT
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
- [ ] **4.5.3** `GET /auth/jwks` - return JWK Set for token verification
  - Key type: OKP (Octet Key Pair)
  - Curve: Ed25519
  - Algorithm: EdDSA
- [ ] **4.5.4** `GET /auth/trusted-issuers` - return trusted issuer list
- [ ] **4.5.5** `POST /demo/reset` - clear nonces and audit log
- [ ] **4.5.6** `GET /demo/audit-log` - return authorization decisions
- [ ] **4.5.7** `GET /health` - health check

---

## PHASE 5: Expense API (`src/expense-api/` - Port 3005)

**STATUS: NOT STARTED**
**Progress: 0/14 tasks (0%)**
**Dependencies:** Phase 0, Phase 1, Phase 4 (for JWKS)

### 5.1 Package Setup
- [ ] **5.1.1** Create `src/expense-api/package.json`

### 5.2 Auth and Scope Handling
- [ ] **5.2.1** Create `src/expense-api/auth.ts` - token validation middleware
  - Fetch and cache JWKS from Auth Server (`AUTH_SERVER_URL/auth/jwks`)
  - Verify JWT signature using Ed25519 public key
  - Check token expiry (strict - reject if `exp < now`)
  - Extract scopes and claims into request context
- [ ] **5.2.2** Create `src/expense-api/scopes.ts`
  - `parseApprovalLimit(scope)` - extract N from `expense:approve:max:N`
  - `hasScope(scopes, required)` - check scope presence
  - `requireScope(scope)` - middleware factory for scope enforcement

### 5.3 Demo Data
- [ ] **5.3.1** Create `src/expense-api/demo-data.ts` - initial expenses
  - `exp-001`: $5,000 marketing expense (for happy path - WILL BE APPROVED)
  - `exp-002`: $15,000 executive retreat (for ceiling demo - WILL BE DENIED)
  - `exp-003`: $25,000 urgent expense (for social engineering - WILL BE DENIED)

### 5.4 Express Application
- [ ] **5.4.1** Create `src/expense-api/index.ts` - Express app

### 5.5 Endpoints
- [ ] **5.5.1** `GET /expenses` - list expenses (requires `expense:view` scope)
- [ ] **5.5.2** `GET /expenses/:id` - get expense (requires `expense:view` scope)
- [ ] **5.5.3** `POST /expenses` - create expense (requires `expense:submit` scope)
- [ ] **5.5.4** `POST /expenses/:id/approve` - **THE CRYPTOGRAPHIC CEILING**
  - Requires `expense:approve:max:N` scope
  - Parse approval limit N from scope string
  - **THE CHECK:** `if (expense.amount > approvalLimit) return 403`
  - This is where the math enforces the ceiling
  - No code path can bypass this - the limit comes from the signed credential
  - Response on success: `{ approved: true, expenseId, amount, ceiling, approvedBy, approvedAt }`
  - Response on ceiling violation: `{ error: "forbidden", message: "Amount exceeds approval limit", ceiling: N, requested: amount }`
  - Log to audit with ceiling, amount, decision
- [ ] **5.5.5** `POST /expenses/:id/reject` - reject expense
- [ ] **5.5.6** `POST /demo/reset` - reset expenses to initial state (all pending)
- [ ] **5.5.7** `GET /demo/expenses` - get expenses without auth (for UI display)
- [ ] **5.5.8** `GET /demo/audit-log` - get expense operation logs
- [ ] **5.5.9** `GET /health` - health check

---

## PHASE 6: LLM Agent (`src/llm-agent/` - Port 3004)

**STATUS: NOT STARTED**
**Progress: 0/18 tasks (0%)**
**Dependencies:** Phase 0, Phase 1, Phase 3, Phase 4, Phase 5

### 6.1 Package Setup
- [ ] **6.1.1** Create `src/llm-agent/package.json`

### 6.2 LLM Modes
- [ ] **6.2.1** Create `src/llm-agent/llm/interface.ts` - common LLM interface
  ```typescript
  interface LLM {
    chat(messages: Message[], tools?: Tool[]): Promise<Response>;
  }
  ```
- [ ] **6.2.2** Create `src/llm-agent/llm/mock.ts` - MockLLM with pattern matching
- [ ] **6.2.3** Create `src/llm-agent/llm/mock-responses.ts` - **CRITICAL**: scripted responses
  - **Happy path**: Recognize "$5,000" or "$5k" expense keywords, proceed with approval
  - **Cryptographic ceiling**: Recognize "$15,000" or "$15k", attempt approval (will fail at API)
  - **Social engineering**: Recognize urgent/CEO language, attempt approval anyway (ceiling handles denial)
  - All three scenarios should attempt the expense approval - the ceiling handles denial, not the LLM

### 6.3 Auth Flow
- [ ] **6.3.1** Create `src/llm-agent/auth-flow.ts` - `executeAuthorizationFlow()`
  1. Request presentation challenge from Auth Server (`POST /auth/presentation-request`)
  2. Request VP from Wallet with challenge/domain (`POST /wallet/present`)
  3. Exchange VP for JWT at Auth Server (`POST /auth/token`)
  4. Return token with scopes and expiry
  - Handle errors at each step with clear messages

### 6.4 Expense Flow
- [ ] **6.4.1** Create `src/llm-agent/expense-flow.ts` - `executeExpenseApproval()`
  - Use Bearer token from auth flow
  - Call Expense API approve endpoint (`POST /expenses/:id/approve`)
  - Handle success: return approval confirmation
  - Handle ceiling denial (403): return clear message about limit exceeded
  - Handle other errors: return error message

### 6.5 Session Management
- [ ] **6.5.1** Create `src/llm-agent/sessions.ts` - session management (Map)
  - `createSession()` - new session with unique ID
  - `getSession(id)` - retrieve session
  - `updateSession(id, data)` - update session state
  - `deleteSession(id)` - cleanup
  - Store: scenario, current token, wallet state, action history

### 6.6 System Prompt
- [ ] **6.6.1** Create `src/llm-agent/system-prompt.ts` - for non-mock LLM modes
  - Describe available tools (list expenses, approve expense)
  - Explain authorization flow requirements
  - Define response format

### 6.7 Express Application
- [ ] **6.7.1** Create `src/llm-agent/index.ts` - Express app
  - Load `LLM_MODE` from environment (default: `mock`)
  - Initialize appropriate LLM implementation

### 6.8 Endpoints
- [ ] **6.8.1** `POST /agent/session` - create session
  - Initialize wallet: call `POST /wallet/demo/setup`
  - Reset expenses: call `POST /demo/reset`
  - Return session ID and initial state
- [ ] **6.8.2** `POST /agent/chat` - process message
  - Parse user intent using LLM
  - Execute auth flow if needed (get token)
  - Execute expense operations with token
  - Return response with actions array showing each step
- [ ] **6.8.3** `DELETE /agent/session/:id` - end session
- [ ] **6.8.4** `GET /agent/mode` - get current LLM mode
- [ ] **6.8.5** `POST /agent/mode` - set LLM mode (for testing)
- [ ] **6.8.6** `GET /health` - health check

---

## PHASE 7: Demo UI (`src/demo-ui/` - Port 3000)

**STATUS: NOT STARTED**
**Progress: 0/24 tasks (0%)**
**Dependencies:** All backend services (Phases 0-6)

### 7.1 Package Setup
- [ ] **7.1.1** Create `src/demo-ui/package.json`
  - Must include `dev` script for Dockerfile.ui: `"dev": "npx tsx index.ts"`

### 7.2 Express Static Server
- [ ] **7.2.1** Create `src/demo-ui/index.ts` - serve static files from `public/`

### 7.3 HTML Structure (`src/demo-ui/public/index.html`)
- [ ] **7.3.1** Create single HTML file with embedded CSS/JS (no build step)
- [ ] **7.3.2** Header with scenario selector dropdown (Scenario 1/2/3)
- [ ] **7.3.3** Two-column layout:
  - Left: Chat interface (70% width)
  - Right: Auth flow panel + Credentials panel (30% width)
- [ ] **7.3.4** Bottom panels:
  - Scenario description with suggested input and "Copy" button
  - Audit log with real-time entries

### 7.4 Chat Interface
- [ ] **7.4.1** Message input with send button
- [ ] **7.4.2** Message history display with scrolling
- [ ] **7.4.3** Visual indicators: user messages (right), assistant messages (left), system messages (center)
- [ ] **7.4.4** Loading state with spinner during processing

### 7.5 Authorization Flow Panel
- [ ] **7.5.1** Display 5-step flow with status indicators:
  1. Request Challenge (pending/in-progress/success/failed)
  2. Create Presentation (pending/in-progress/success/failed)
  3. Exchange for Token (pending/in-progress/success/failed)
  4. Call Expense API (pending/in-progress/success/failed)
  5. Ceiling Check (pending/in-progress/success/failed)
- [ ] **7.5.2** Show challenge value, token preview, scopes as flow progresses
- [ ] **7.5.3** Highlight the approval limit in the scopes

### 7.6 Credentials Panel
- [ ] **7.6.1** Display wallet contents (credential types)
- [ ] **7.6.2** Highlight `approvalLimit: $10,000` value (THE CEILING)
- [ ] **7.6.3** Show credential types, issuer DID (truncated), validity

### 7.7 Scenario Panel
- [ ] **7.7.1** Show scenario name and description
- [ ] **7.7.2** Suggested input text with "Copy to Input" button
- [ ] **7.7.3** Expected outcome indicator (green: approved, red: denied)

### 7.8 Audit Log Panel
- [ ] **7.8.1** Real-time audit entries from all services
- [ ] **7.8.2** Color-coded by event type:
  - Green: approved/success
  - Red: denied/failed
  - Yellow/Orange: in-progress/warning
- [ ] **7.8.3** Timestamp and event details

### 7.9 Styling (Dark Terminal Theme)
- [ ] **7.9.1** Dark background: `#1a1a2e` or similar
- [ ] **7.9.2** Accent colors: cyan for info, green for success, red for errors
- [ ] **7.9.3** Monospace font for technical data (DIDs, tokens, JSON)
- [ ] **7.9.4** Responsive layout for presentation screen

### 7.10 JavaScript Functionality
- [ ] **7.10.1** Session management (create on load, cleanup on window close)
- [ ] **7.10.2** Chat handling (send message via fetch, display response)
- [ ] **7.10.3** Auth flow visualization updates (update step status as actions complete)
- [ ] **7.10.4** Keyboard shortcuts:
  - 1/2/3: Select scenarios
  - Enter: Send message
  - Escape: Clear input

---

## PHASE 8: Integration Testing

**STATUS: NOT STARTED**
**Progress: 0/15 tasks (0%)**
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
- [ ] **8.2.1** VC Issuer:
  - Credential structure matches VC 2.0 spec
  - DataIntegrityProof present with correct cryptosuite
  - `validFrom` used (not `issuanceDate`)
- [ ] **8.2.2** VC Wallet:
  - Signature verification works (valid signature accepted)
  - Invalid signatures rejected
  - Non-holder credentials rejected (subject.id mismatch)
  - VP includes challenge/domain in proof
- [ ] **8.2.3** Auth Server:
  - Nonce is single-use (second attempt fails)
  - VP with wrong challenge rejected
  - VP with untrusted issuer rejected
  - Scope derivation correct (limit from credential)
- [ ] **8.2.4** Expense API:
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

**STATUS: PARTIALLY EXISTS (needs fixes)**
**Progress: 3/11 tasks (27%)**
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
- [ ] **9.4.1** Configure Docker health checks for each service
- [ ] **9.4.2** Verify startup order with health check dependencies

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
| Phase 0 | 18 | 0 complete |
| Phase 1 | 27 | 0 complete |
| Phase 2 | 12 | 0 complete |
| Phase 3 | 14 | 0 complete |
| Phase 4 | 16 | 0 complete |
| Phase 5 | 14 | 0 complete |
| Phase 6 | 18 | 0 complete |
| Phase 7 | 24 | 0 complete |
| Phase 8 | 15 | 0 complete |
| Phase 9 | 11 | 3 complete |
| **Total** | **169** | **3 complete (2%)** |
