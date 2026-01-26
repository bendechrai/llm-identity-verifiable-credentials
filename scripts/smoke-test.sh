#!/bin/bash
# smoke-test.sh — Build and health-check all application services.
# Designed to run from inside ralph's container (Docker socket access).
# Exits 0 if all services pass health checks, 1 otherwise.

set -euo pipefail

TIMEOUT=${SMOKE_TIMEOUT:-120}
COMPOSE_FILE="docker-compose.yaml"
# All services EXCEPT ralph (avoid recursive startup)
SERVICES="vc-issuer vc-wallet auth-server expense-api llm-agent demo-ui"

cleanup() {
    echo "Cleaning up smoke test services..."
    docker compose -f "$COMPOSE_FILE" stop $SERVICES 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" rm -f $SERVICES 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Smoke Test: Building and starting services ==="
docker compose -f "$COMPOSE_FILE" up --build -d $SERVICES

echo "=== Waiting for health checks (timeout: ${TIMEOUT}s) ==="
ELAPSED=0
INTERVAL=5
ALL_HEALTHY=false

while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
    ALL_HEALTHY=true
    for service in $SERVICES; do
        HEALTH=$(docker compose -f "$COMPOSE_FILE" ps --format json "$service" 2>/dev/null \
            | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")
        if [ "$HEALTH" != "healthy" ]; then
            ALL_HEALTHY=false
            break
        fi
    done

    if [ "$ALL_HEALTHY" = true ]; then
        echo "All services healthy after ${ELAPSED}s"
        break
    fi

    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
    echo "  Waiting... (${ELAPSED}s / ${TIMEOUT}s)"
done

if [ "$ALL_HEALTHY" != true ]; then
    echo ""
    echo "FAIL: Not all services became healthy within ${TIMEOUT}s"
    echo ""
    echo "Service status:"
    docker compose -f "$COMPOSE_FILE" ps $SERVICES
    echo ""
    echo "Logs from failing services:"
    for service in $SERVICES; do
        HEALTH=$(docker compose -f "$COMPOSE_FILE" ps --format json "$service" 2>/dev/null \
            | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")
        if [ "$HEALTH" != "healthy" ]; then
            echo "--- $service ---"
            docker compose -f "$COMPOSE_FILE" logs --tail=30 "$service"
        fi
    done
    exit 1
fi

echo ""
echo "=== Smoke test PASSED ==="
exit 0
