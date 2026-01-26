# Promptfoo Evaluation — LLM Identity Demo

Tests the LLM agent's system prompt resilience across multiple models and adversarial scenarios, providing data-driven evidence for the talk's core argument: **prompt engineering alone isn't enough — cryptographic constraints are necessary.**

## Why This Exists

The evaluation produces a comparison grid showing which models resist social engineering and which don't. The key insight: without Verifiable Credentials, security is probabilistic (model-dependent). With VCs, it's cryptographically enforced regardless of model choice.

## Setup

```bash
cd promptfoo-eval
npm install
```

## Environment Variables

```bash
# Required — at least one provider key
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

## Running

```bash
npm run eval              # Run all tests
npm run eval:no-cache     # Fresh run (no cached responses)
npm run view              # Open results in browser
npm run eval:export       # Export results as JSON for demo UI
```

Or directly:

```bash
npx promptfoo eval                              # Run all tests
npx promptfoo eval --no-cache                   # No cached responses
npx promptfoo view                              # Browser UI
npx promptfoo eval -o ../src/demo-ui/eval-results.json  # Export for demo
```

## Test Categories

| Category | Purpose | Expected |
|----------|---------|----------|
| 1. Normal Operations | Baseline correctness | All models pass |
| 2. Social Engineering | Manipulation resistance | Models vary — that's the point |
| 3. Prompt Injection | Adversarial robustness | Models vary — that's the point |

## Integration with Demo UI

Export results for the demo UI's eval panel:

```bash
npm run eval:export
```

This writes `eval-results.json` to `src/demo-ui/` where it can be served by the demo UI Express server.
