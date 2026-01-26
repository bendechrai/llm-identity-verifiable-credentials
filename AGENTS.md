# LLM Identity Demo - Agent Operations Guide

## Build & Run

```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up vc-issuer
docker-compose up vc-wallet
docker-compose up auth-server
docker-compose up expense-api
docker-compose up llm-agent
docker-compose up demo-ui
```

## Validation

Run these after implementing to get immediate feedback:

```bash
# Tests
npm test

# Typecheck
npm run typecheck

# Lint
npm run lint

# Integration tests (requires all services running)
npm run test:integration
```

## Architecture

```
VC Issuer (HR)     :3001    Auth Server       :3003
Employee Wallet    :3002    Expense API       :3005
LLM Agent          :3004    Demo UI           :3000
```

## Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| VC Issuer | 3001 | Issues EmployeeCredential + FinanceApproverCredential |
| VC Wallet | 3002 | Stores credentials, creates Verifiable Presentations |
| Auth Server | 3003 | Verifies VPs, issues constrained JWTs (trust boundary) |
| LLM Agent | 3004 | Orchestrates authorization flow |
| Expense API | 3005 | Pure resource server, validates JWTs, enforces ceiling |
| Demo UI | 3000 | Presentation interface |

## Codebase Patterns

### VC Data Model 2.0
- Context: `https://www.w3.org/ns/credentials/v2`
- Proof type: `DataIntegrityProof`
- Cryptosuite: `eddsa-rdfc-2022`
- Libraries: `@digitalbazaar/vc`, `@digitalbazaar/eddsa-rdfc-2022-cryptosuite`

### DID Method
- Use `did:key` for all DIDs (no external infrastructure)
- DIDs derived from Ed25519 public keys

### Authorization Flow
1. Agent → Auth Server: Request nonce
2. Agent → Wallet: Request VP with nonce
3. Agent → Auth Server: Exchange VP for JWT
4. Agent → Expense API: Call with JWT

### Nonce Flow (OpenID4VP style)
- Auth Server generates challenge (nonce)
- Wallet embeds challenge + domain in VP proof
- Auth Server validates nonce is fresh, unused, correct domain
- Single-use: nonce marked as spent after successful verification

### Token Constraints
- 60-second expiration
- Scope format: `expense:approve:max:10000` (explicit value)
- Ceiling derived from FinanceApproverCredential.approvalLimit

### LLM Modes
- Set `LLM_MODE` env var: `mock`, `ollama`, `openai`, `anthropic`
- Mock mode uses scripted responses for deterministic demos
- Real modes require API keys in `.env`
- Switch at runtime via `POST /agent/mode` with `{"mode": "mock|anthropic|openai|ollama"}`

### Real LLM Backend Environment Variables
- `ANTHROPIC_API_KEY` - Claude API key
- `OPENAI_API_KEY` - OpenAI API key
- `OLLAMA_URL` - Ollama server URL (default: `http://localhost:11434`)
- `ANTHROPIC_MODEL` - Override Claude model (default: `claude-3-5-haiku-20241022`)
- `OPENAI_MODEL` - Override OpenAI model (default: `gpt-4o-mini`)
- `OLLAMA_MODEL` - Override Ollama model (default: `llama3.2`)

### Demo Scenarios (THREE)
1. **happy-path**: $5k expense, $10k limit → approved
2. **cryptographic-ceiling**: $15k expense, $10k limit → denied
3. **social-engineering**: manipulation attempt → denied

### Protection Mode
- Sessions accept `protected` flag (default: `true`)
- `protected: true` → Full VC authorization flow (nonce → VP → JWT → ceiling check)
- `protected: false` → LLM decides alone, calls `/expenses/:id/approve-unprotected`
- Unprotected endpoint: no JWT, no ceiling check, always approves

### Mock Intent Parser
- Amount matching checks larger amounts first to avoid substring collision
- e.g., "$15,000" contains "5,000" — check exp-003/exp-002 before exp-001

### Error Handling
- All errors return structured JSON with `error` and `message` fields
- HTTP status codes: 401 (no/invalid token), 403 (ceiling exceeded), 400 (validation)
- Ceiling violations return explicit `ceiling` and `requested` amounts

### npm dependency fix
- If `vitest run` fails with `Cannot find module @rollup/rollup-linux-arm64-gnu`, run `npm i` to install platform-specific optional deps
