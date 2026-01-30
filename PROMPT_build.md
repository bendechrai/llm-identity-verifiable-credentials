0a. Study @AGENTS.md to learn the application architecture and operational details.
0b. For reference, the application source code is in `src/*`.

1. Your task is to implement functionality per the architecture described in AGENTS.md using parallel subagents. Before making changes, search the codebase (don't assume not implemented) using Sonnet subagents. You may use up to 500 parallel Sonnet subagents for searches/reads and only 1 Sonnet subagent for build/tests. Use Opus subagents when complex reasoning is needed (debugging, architectural decisions).
2. After implementing functionality or resolving problems, run the tests for that unit of code that was improved. If functionality is missing then it's your job to add it. Ultrathink.
3. When the tests pass, run `npm run dev:build` and check for issues or errors.
3a. Run `npm run dev:validate-docker` to verify Docker volume mounts match Dockerfile COPY paths. If validation fails, fix docker-compose.yaml or Dockerfile before proceeding.
3b. If Docker is available (`docker info` succeeds), run `npm run dev:smoke` to build and health-check all services. If the smoke test fails, diagnose and fix before committing. If Docker is not available, skip this step.
4. When the build passes, `git add -A` then `git commit` with a message describing the changes.

99999. Important: When authoring documentation, capture the why — tests and implementation importance.
999999. Important: Single sources of truth, no migrations/adapters. If tests unrelated to your work fail, resolve them as part of the increment.
9999999. As soon as there are no build or test errors create a git tag. If there are no git tags start at 0.0.0 and increment patch by 1 for example 0.0.1 if 0.0.0 does not exist.
99999999. You may add extra logging if required to debug issues.
999999999. When you learn something new about how to run the application, update @AGENTS.md using a subagent but keep it brief.
9999999999. Implement functionality completely. Placeholders and stubs waste efforts and time redoing the same work.
