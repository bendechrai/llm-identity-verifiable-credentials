# LLM Identity Demo

Demo application for "Building Identity into LLM Workflows with Verifiable Credentials".

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Demo UI    │────▶│  LLM Agent  │────▶│ Expense API │
│   :3000     │     │   :3004     │     │   :3003     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  VC Wallet  │◀────│  VC Issuer  │
                    │   :3002     │     │   :3001     │
                    └─────────────┘     └─────────────┘
```

## Quick Start

```bash
# Mock mode (deterministic, no LLM required)
npm run dev:mock

# With local Ollama
npm run dev:ollama

# With OpenAI (requires OPENAI_API_KEY)
OPENAI_API_KEY=sk-... npm run dev:openai
```

Then open http://localhost:3000

## Demo Scenarios

1. **Happy Path** - Valid credentials, amount within ceiling
2. **Missing Credential** - No employment credential
3. **Insufficient Role** - Amount exceeds approval ceiling
4. **Social Engineering** - LLM attempts to bypass limits (fails)

## Development with Ralph Loop

This project uses the Ralph Wiggum technique for AI-assisted development.

```bash
# Planning mode
./loop.sh plan

# Building mode
./loop.sh build
```

See `AGENTS.md` for operational details.

## Project Structure

```
├── specs/              # Feature specifications
│   ├── vc-issuer.md
│   ├── vc-wallet.md
│   ├── expense-api.md
│   ├── llm-agent.md
│   └── demo-ui.md
├── src/                # Service implementations
│   ├── vc-issuer/
│   ├── vc-wallet/
│   ├── expense-api/
│   ├── llm-agent/
│   └── demo-ui/
├── shared/             # Shared types and utilities
├── AGENTS.md           # Operational guide
├── PROMPT_plan.md      # Ralph planning prompt
├── PROMPT_build.md     # Ralph building prompt
└── IMPLEMENTATION_PLAN.md  # Progress tracking
```

## Key Concepts

**Verifiable Credentials (VCs)** - W3C standard for cryptographically signed claims. The demo uses:
- `EmploymentCredential` - Proves employment at organization
- `RoleCredential` - Proves role with approval ceiling

**Approval Ceilings** - Hard limits that cannot be bypassed:
- `expense.approve.1k` - Up to $1,000
- `expense.approve.10k` - Up to $10,000
- `expense.approve.unlimited` - No ceiling

**The Pattern**: VC → Claim Extraction → Scoped OAuth Token → Ceiling Enforcement

## License

MIT
