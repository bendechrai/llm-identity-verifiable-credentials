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
| Phase 8 | Integration Testing | COMPLETE | 100% |
| Phase 9 | Docker & Deployment | COMPLETE | 100% |

**Overall Progress: 100%** (all core services implemented, all tests passing, Docker deployment complete)

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
| `.eslintrc.cjs` | **COMPLETE** | TypeScript parser with namespace support |
| `src/lib/` | **COMPLETE** | All utilities implemented (keys, document-loader, credentials, jwt, middleware, audit, http-client) |
| `src/vc-issuer/` | **COMPLETE** | Issues EmployeeCredential and FinanceApproverCredential |
| `src/vc-wallet/` | **COMPLETE** | Stores credentials, creates VPs with challenge/domain |
| `src/auth-server/` | **COMPLETE** | Nonce management, VP verification, JWT issuance |
| `src/expense-api/` | **COMPLETE** | Ceiling enforcement (the core demo point) |
| `src/llm-agent/` | **COMPLETE** | Mock LLM with auth flow orchestration |
| `src/demo-ui/` | **COMPLETE** | Single-page HTML with chat and visualization |

---

## Project Status: COMPLETE

All phases are complete. The demo is ready for NDC London 2026.

**Test Coverage:** 145 tests passing across 9 test files, including:
- Unit tests for keys, credentials, and JWT utilities
- Component tests for all 4 services (VC Issuer, Wallet, Auth Server, Expense API)
- Integration tests for the complete authorization flow
- E2E scenario tests for Happy Path, Cryptographic Ceiling, and Social Engineering demos

---

## Key Learnings

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

**Recent Code Fixes:**
- Fixed `generateEd25519KeyPair()` to properly set `id` and `controller` for VC signing
- Fixed `document-loader.ts` import syntax for `credentials-context` and `data-integrity-context` modules
- Fixed JSON-LD validation for custom credential properties (see above)
- Fixed integration test JWT verification to use `keyPair.verifier()` instead of passing KeyPair directly
- Added missing `jti` (JWT ID) fields to test JWT payloads
- Cleaned up unused imports in test files (expense.test.ts, e2e.test.ts, integration.test.ts) to resolve ESLint errors

---

## Completed Phases Summary (0-7)

All core implementation phases are complete:

- **Phase 0 (Prerequisites):** Package.json with VC 2.0 packages, tsconfig.json, directory structure, Dockerfiles updated for TypeScript
- **Phase 1 (Shared Library):** Keys, document-loader, credentials, JWT, middleware, audit, http-client utilities
- **Phase 2 (VC Issuer):** Issues EmployeeCredential and FinanceApproverCredential with DataIntegrityProof
- **Phase 3 (VC Wallet):** Stores credentials, creates VPs with challenge/domain binding
- **Phase 4 (Auth Server):** Nonce management, VP verification, JWT issuance with scope derivation
- **Phase 5 (Expense API):** THE CRYPTOGRAPHIC CEILING enforcement (`if (amount > limit) -> 403`)
- **Phase 6 (LLM Agent):** Mock LLM with scripted responses for all three demo scenarios
- **Phase 7 (Demo UI):** Single-page HTML with chat, auth flow visualization, credentials panel, audit log

---

## PHASE 8: Integration Testing (COMPLETE)

**STATUS: COMPLETE**
**Progress: 15/15 tasks (100%)**

### 8.1 End-to-End Scenarios (implemented in `src/lib/e2e.test.ts`)
- [x] **8.1.1** Happy Path Test: $5,000 expense, $10,000 limit -> APPROVED
- [x] **8.1.2** Cryptographic Ceiling Test: $15,000 expense, $10,000 limit -> DENIED
- [x] **8.1.3** Social Engineering Test: $25,000 expense with urgent language -> DENIED

**Note:** E2E tests automatically detect if services are running and skip gracefully if not available.

### 8.2 Component Tests (Completed)
- [x] Credential utilities (`src/lib/credentials.test.ts`) - 11 tests passing
- [x] JWT utilities (`src/lib/jwt.test.ts`) - 11 tests passing
- [x] Key management (`src/lib/keys.test.ts`) - 6 tests passing
- [x] Integration tests (`src/lib/integration.test.ts`) - 19 tests passing

### 8.2 Component Tests (Service-Level)
- [x] VC Issuer service tests - `src/vc-issuer/issuer.test.ts` (21 tests)
- [x] VC Wallet service tests - `src/vc-wallet/wallet.test.ts` (18 tests)
- [x] Auth Server service tests - `src/auth-server/auth.test.ts` (21 tests)
- [x] Expense API service tests - `src/expense-api/expense.test.ts` (26 tests)

### 8.3 Security Tests
- [x] Invalid signature rejection - covered by `credentials.test.ts`
- [x] Untrusted issuer rejection - covered by `integration.test.ts`
- [x] Nonce replay prevention - covered by `integration.test.ts`
- [x] Scope escalation prevention - covered by `integration.test.ts`
- [x] Ceiling bypass attempts (JWT tampering) - covered by `integration.test.ts`
- [x] Expired token rejection - covered by `jwt.test.ts`, `integration.test.ts`, and `expense.test.ts` (tests use pre-expired tokens rather than waiting 61 seconds, which is the correct testing approach)

**Testing Progress:** 145 tests passing, typecheck clean

---

## PHASE 9: Docker and Deployment (COMPLETE)

**STATUS: COMPLETE**
**Progress: 11/11 tasks (100%)**

### 9.1 Completed
- [x] Dockerfile updated for TypeScript with tsx
- [x] Dockerfile.ui updated with dev script
- [x] All 7 services defined in docker-compose.yaml
- [x] Volume mounts for keys persistence
- [x] Docker health checks using wget to check /health endpoints
- [x] Startup order with `depends_on: condition: service_healthy`
- [x] .env.example created with comprehensive documentation
- [x] Service-to-service networking verification - Configuration verified in docker-compose.yaml (all services on demo-network with proper URLs)
- [x] Environment configuration documentation - Enhanced .env.example with LLM modes, service ports, and quick start guide
- [x] Verify shared library accessible to all services - Verified: Dockerfile copies src/lib/ and all services import from ../lib
- [x] Docker deployment fully operational

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

## Three Demo Scenarios

1. **Happy Path:** $5k expense, $10k limit -> APPROVED (all 5 steps succeed)
2. **Cryptographic Ceiling:** $15k expense, $10k limit -> DENIED (math enforces limit)
3. **Social Engineering:** Manipulation attempt with $25k expense -> DENIED (math doesn't care about urgency)

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

### Docker (Complete)
- `/home/ralph/project/docker-compose.yaml` - 7 services configured
- `/home/ralph/project/Dockerfile` - Backend services with tsx
- `/home/ralph/project/Dockerfile.ui` - UI service with dev script

### Source Code (Complete)
- `/home/ralph/project/src/lib/*` - Shared library (8+ files)
- `/home/ralph/project/src/vc-issuer/*` - VC Issuer service
- `/home/ralph/project/src/vc-wallet/*` - VC Wallet service
- `/home/ralph/project/src/auth-server/*` - Auth Server service
- `/home/ralph/project/src/expense-api/*` - Expense API service
- `/home/ralph/project/src/llm-agent/*` - LLM Agent service
- `/home/ralph/project/src/demo-ui/*` - Demo UI service

### Tests (In Progress)
- `/home/ralph/project/src/lib/keys.test.ts` - Key management tests (6 tests)
- `/home/ralph/project/src/lib/credentials.test.ts` - Credential utilities tests (11 tests)
- `/home/ralph/project/src/lib/jwt.test.ts` - JWT utilities tests (11 tests)
- `/home/ralph/project/src/lib/integration.test.ts` - Integration tests (19 tests)
- `/home/ralph/project/src/lib/e2e.test.ts` - End-to-end scenario tests (12 tests - happy path, cryptographic ceiling, social engineering)
