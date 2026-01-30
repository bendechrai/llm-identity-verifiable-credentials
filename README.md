# Building Identity into LLM Workflows with Verifiable Credentials

Demo application and presentation materials for the talk "Building Identity into LLM Workflows with Verifiable Credentials" by Ben Dechrai.

## What This Is

A working demo that shows why bearer tokens (JWTs) are insufficient for AI agent authorisation, and how W3C Verifiable Credentials with holder binding solve the problem.

The demo runs two modes side-by-side:
- **Act 1 (JWT-only)** — an attacker steals a bearer token and uses it freely
- **Act 2 (Credential-protected)** — the same attack fails because tokens are single-use, short-lived, and cryptographically bound to the holder

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Demo UI    │────▶│  LLM Agent  │────▶│ Expense API │
│   :3000     │     │   :3004     │     │   :3005     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  VC Wallet  │     │ Auth Server │
                    │   :3002     │     │   :3003     │
                    └─────────────┘     └─────────────┘
                           ▲
                    ┌─────────────┐
                    │  VC Issuer  │
                    │   :3001     │
                    └─────────────┘
```

| Service | Port | Purpose |
|---------|------|---------|
| Demo UI | 3000 | Presentation interface |
| VC Issuer | 3001 | Issues EmployeeCredential + FinanceApproverCredential |
| VC Wallet | 3002 | Stores credentials, creates Verifiable Presentations |
| Auth Server | 3003 | Verifies VPs, issues constrained JWTs |
| LLM Agent | 3004 | Orchestrates authorisation flow |
| Expense API | 3005 | Resource server, validates JWTs, enforces ceiling |

## Quick Start

```bash
# Mock mode (deterministic, no LLM required)
npm run dev:mock

# With local Ollama
npm run dev:ollama

# With OpenAI (requires OPENAI_API_KEY)
npm run dev:openai
```

Then open http://localhost:3000

## Demo Scenarios

1. **Happy Path** — $5k expense, $10k approval limit, approved
2. **Cryptographic Ceiling** — $15k expense, $10k limit, denied by maths
3. **Social Engineering** — manipulation attempt, denied by maths

## Project Structure

```
├── src/                    # Service implementations
│   ├── auth-server/
│   ├── demo-ui/
│   ├── expense-api/
│   ├── lib/
│   ├── llm-agent/
│   ├── vc-issuer/
│   └── vc-wallet/
├── shared/                 # Shared types and utilities
├── presentation/           # Talk slides
│   ├── 20-minutes/         # 20-minute version
│   └── 60-minutes/         # 60-minute version (Reveal.js)
├── promptfoo-eval/         # Evaluation suite
├── AGENTS.md               # Operational guide
└── PROMPT_build.md         # AI-assisted build prompt
```

## Key Concepts

**Verifiable Credentials (VCs)** — W3C standard for cryptographically signed claims. The demo uses:
- `EmployeeCredential` — proves employment at organisation
- `FinanceApproverCredential` — proves role with approval ceiling

**Holder Binding** — the credential is bound to the holder's private key. Only the holder can create valid Verifiable Presentations.

**The Pattern**: Agent → API (401) → Auth Server (get presentation request) → Wallet (create VP) → Auth Server (VP → scoped JWT) → API (request + JWT)

## Presentation

The `presentation/60-minutes/` directory contains a Reveal.js presentation. To run it:

```bash
cd presentation/60-minutes
npm install
# Open index.html in a browser
```

The presentation covers:
- Social engineering of LLMs (real research)
- Why OAuth bearer tokens are the vulnerability
- How Verifiable Credentials solve the problem
- Live demos of both modes

## Evaluation Suite

See `promptfoo-eval/README.md` for the evaluation suite that tests the demo against multiple LLMs with social engineering and prompt injection attacks.

## License

MIT
