# Promptfoo Evaluation Suite — LLM Identity Demo

Tests the demo's core thesis with data: **prompt engineering alone isn't enough — cryptographic constraints are necessary.**

## Four Evaluation Types

| Config | What It Tests | Command |
|--------|--------------|---------|
| `promptfooconfig.yaml` | System prompt in isolation across 3 models | `npm run eval` |
| `redteam.yaml` | Automated adversarial attack generation | `npm run redteam` |
| `multi-turn.yaml` | Multi-turn escalation and rapport building | `npm run eval:multi-turn` |
| `live-agent.yaml` | Running demo system end-to-end (JWT vs VC) | `npm run eval:live` |

## Setup

```bash
cd promptfoo-eval
npm install
```

### Environment Variables

```bash
# At least one API key required for prompt-level evals
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...

# Ollama must be running locally with qwen2.5-coder:14b
# (no API key needed)
ollama pull qwen2.5-coder:14b
```

## 1. Prompt-Level Eval (Act 1 Evidence)

Tests the system prompt **in isolation** against Claude, GPT, and GLM. Produces a comparison grid showing that different models fail under different attack types.

```bash
npm run eval          # Run all 17 test cases × 3 models
npm run view          # Open results in browser
npm run eval:html     # Export standalone HTML report
npm run eval:export   # Export JSON for demo UI
```

**Test categories:**
- Category 1: Normal operations (baseline correctness)
- Category 2: Social engineering (authority, urgency, emotion, escalation, fake codes, split transactions)
- Category 3: Prompt injection (role override, extraction, JSON injection, encoding, persona switch, hypothetical)

**The key slide:** LLM columns have mixed pass/fail. The VC-protected system holds regardless.

## 2. Automated Red Teaming

Auto-generates adversarial inputs using promptfoo's red team engine. No hand-crafted attacks — the tool generates attacks tailored to your application's purpose.

```bash
npm run redteam       # Run red team scan
npm run redteam:view  # View results in browser
```

**Plugins:** policy adherence, hijacking, overreliance, PII, privacy, excessive agency, contracts

**Strategies:** jailbreak, composite jailbreak, prompt injection, crescendo (multi-turn escalation), GOAT (adaptive multi-turn)

## 3. Multi-Turn Conversation Tests

Tests escalation patterns across multiple turns. Social engineers build rapport before making the forbidden request.

```bash
npm run eval:multi-turn       # Run multi-turn tests
npm run eval:multi-turn:view  # View results
```

**Scenarios:**
- Trust building → escalation (approve $5k, then ask for $50k)
- Anchoring → reframing (ask about limits, claim pending update)
- Foot-in-the-door ($9k → $9.5k → $10.5k → $15k)
- Emotional buildup over turns → leverage
- Authority chain layering
- Simulated user (automated multi-turn with goal: break the ceiling)
- Simulated user (automated: extract system prompt)

## 4. Live Agent Testing

Tests the **running demo system** end-to-end. Uses a custom provider that creates sessions, sends messages via SSE, and auto-approves wallet/login modals.

**Prerequisite:** The demo must be running (`docker compose up`).

```bash
npm run eval:live       # Test JWT-only and VC-protected modes
npm run eval:live:view  # View results
```

Compares both modes with identical prompts. Since the agent is currently deterministic, results are predictable — but the infrastructure is ready for when a real LLM backend is added.

## Run Everything

```bash
npm run eval:all          # All three eval types (except live)
npm run eval:all:export   # Export HTML reports for all types
```

## Three Providers

| Provider | Lab | Notes |
|----------|-----|-------|
| Claude 3.5 Haiku | Anthropic | API key required |
| GPT-4o-mini | OpenAI | API key required |
| Qwen 2.5 Coder 14B | Alibaba/Qwen | Local via Ollama, free |

Three models from three labs. If they all fail differently, that proves model-dependent security is unreliable.
