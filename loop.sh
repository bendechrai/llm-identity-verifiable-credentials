#!/bin/bash
# Ralph Wiggum loop script for AI-assisted development

set -e

MODE="${1:-build}"
MODEL="${CLAUDE_MODEL:-claude-sonnet-4-20250514}"
MAX_TURNS="${MAX_TURNS:-50}"

case "$MODE" in
  plan)
    PROMPT_FILE="PROMPT_plan.md"
    ;;
  build)
    PROMPT_FILE="PROMPT_build.md"
    ;;
  *)
    echo "Usage: $0 [plan|build]"
    echo ""
    echo "Modes:"
    echo "  plan  - Planning mode: research and design"
    echo "  build - Building mode: implement and test"
    echo ""
    echo "Environment:"
    echo "  CLAUDE_MODEL  - Model to use (default: claude-sonnet-4-20250514)"
    echo "  MAX_TURNS     - Max agentic turns (default: 50)"
    exit 1
    ;;
esac

if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: $PROMPT_FILE not found"
  exit 1
fi

echo "Starting Ralph loop in $MODE mode..."
echo "Model: $MODEL"
echo "Max turns: $MAX_TURNS"
echo ""

# Run Claude Code with the prompt
claude --model "$MODEL" \
  --max-turns "$MAX_TURNS" \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep,Task" \
  --prompt "$(cat $PROMPT_FILE)"
