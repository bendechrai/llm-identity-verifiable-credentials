# Expense API (Resource Server)

## Overview

The Expense API is a pure resource server that manages expense reports and approvals. It validates access tokens issued by the Authorization Server and enforces the constraints embedded in those tokens. This service does NOT verify Verifiable Credentials directly — that's the Auth Server's job.

**Port:** 3005

## Jobs to Be Done

1. Validate access tokens from the Auth Server
2. Enforce scope-based access control
3. Enforce the cryptographic ceiling (approval limits from token claims)
4. Manage expense report data
5. Log all expense operations for audit

## The Cryptographic Ceiling Enforcement

The Expense API enforces the ceiling through a simple rule:

```
IF expense.amount > token.claims.approvalLimit THEN REJECT
```

This check happens in code, not in the LLM. The LLM can be as persuasive as it wants — this line of code doesn't care.

## API Endpoints

### Token Validation

All protected endpoints require a valid JWT from the Auth Server:

```
Authorization: Bearer <token>
```

Token validation:
1. Verify signature using Auth Server's JWKS (`GET http://auth-server:3003/auth/jwks`)
2. Check `exp` (must not be expired — remember, tokens are only valid for 60 seconds)
3. Check `aud` matches `expense-api`
4. Extract `scope` and `claims` for authorization

### GET /expenses

List expense reports.

**Required scope:** `expense:view`

Response:
```json
{
  "expenses": [
    {
      "id": "exp-001",
      "description": "Marketing materials for Q1 campaign",
      "amount": 5000,
      "currency": "USD",
      "status": "pending",
      "submittedBy": "did:key:z6Mk...",
      "submittedAt": "2026-01-20T14:00:00Z"
    },
    {
      "id": "exp-002",
      "description": "Executive retreat venue booking",
      "amount": 15000,
      "currency": "USD",
      "status": "pending",
      "submittedBy": "did:key:z6Mk...",
      "submittedAt": "2026-01-20T15:30:00Z"
    }
  ]
}
```

### GET /expenses/:id

Get a specific expense report.

**Required scope:** `expense:view`

Response:
```json
{
  "id": "exp-001",
  "description": "Marketing materials for Q1 campaign",
  "amount": 5000,
  "currency": "USD",
  "category": "marketing",
  "status": "pending",
  "submittedBy": "did:key:z6Mk...",
  "submittedAt": "2026-01-20T14:00:00Z",
  "receipts": ["receipt-001.pdf"],
  "notes": "Approved by department head verbally"
}
```

### POST /expenses

Submit a new expense report.

**Required scope:** `expense:submit`

Request:
```json
{
  "description": "Marketing materials for Q1 campaign",
  "amount": 5000,
  "currency": "USD",
  "category": "marketing"
}
```

Response:
```json
{
  "id": "exp-003",
  "status": "pending",
  "submittedAt": "2026-01-21T10:30:00Z"
}
```

### POST /expenses/:id/approve

Approve an expense report.

**Required scope:** `expense:approve:max:*` (where `*` >= expense amount)

Request:
```json
{
  "approved": true,
  "notes": "Approved for Q1 budget"
}
```

**Processing:**

```javascript
async function approveExpense(expenseId, token, request) {
  // 1. Get the expense
  const expense = await getExpense(expenseId);
  if (!expense) {
    return { error: 'not_found', message: 'Expense not found' };
  }

  // 2. Parse the approval limit from scope
  // Scope format: expense:approve:max:10000
  const approvalLimit = parseApprovalLimit(token.scope);
  if (approvalLimit === null) {
    return { error: 'forbidden', message: 'No approval scope in token' };
  }

  // 3. THE CRYPTOGRAPHIC CEILING - this is the key check
  if (expense.amount > approvalLimit) {
    return {
      error: 'forbidden',
      message: `Expense amount ($${expense.amount}) exceeds your approval limit ($${approvalLimit})`,
      ceiling: approvalLimit,
      requested: expense.amount
    };
  }

  // 4. Within ceiling - approve
  expense.status = 'approved';
  expense.approvedBy = token.sub;
  expense.approvedAt = new Date().toISOString();
  expense.approvalNotes = request.notes;

  await saveExpense(expense);

  return {
    approved: true,
    expenseId: expense.id,
    amount: expense.amount,
    ceiling: approvalLimit,
    approvedBy: token.sub
  };
}
```

Response (within ceiling):
```json
{
  "approved": true,
  "expenseId": "exp-001",
  "amount": 5000,
  "ceiling": 10000,
  "approvedBy": "did:key:z6Mk...",
  "approvedAt": "2026-01-21T10:31:00Z"
}
```

Response (exceeds ceiling):
```json
{
  "error": "forbidden",
  "message": "Expense amount ($15,000) exceeds your approval limit ($10,000)",
  "ceiling": 10000,
  "requested": 15000
}
```

This error message is important for the demo — it clearly shows the ceiling enforcement.

### POST /expenses/:id/reject

Reject an expense report.

**Required scope:** `expense:approve:max:*` (any approval authority can reject)

Request:
```json
{
  "rejected": true,
  "reason": "Missing receipts"
}
```

Response:
```json
{
  "rejected": true,
  "expenseId": "exp-001",
  "rejectedBy": "did:key:z6Mk...",
  "rejectedAt": "2026-01-21T10:31:00Z"
}
```

## Scope Parsing

```javascript
function parseApprovalLimit(scope) {
  // scope might be: "expense:view expense:submit expense:approve:max:10000"
  const scopes = scope.split(' ');
  for (const s of scopes) {
    const match = s.match(/^expense:approve:max:(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null; // No approval scope
}
```

## Audit Logging

Every expense operation must be logged:

```json
{
  "timestamp": "2026-01-21T10:31:00Z",
  "event": "expense_approval",
  "tokenId": "jti-from-token",
  "tokenSubject": "did:key:z6Mk...",
  "expenseId": "exp-001",
  "expenseAmount": 5000,
  "approvalCeiling": 10000,
  "withinCeiling": true,
  "decision": "approved",
  "tokenClaims": {
    "employeeId": "E-1234",
    "name": "Alice Chen"
  }
}
```

For ceiling violations:

```json
{
  "timestamp": "2026-01-21T10:32:00Z",
  "event": "expense_approval_denied",
  "tokenId": "jti-from-token",
  "tokenSubject": "did:key:z6Mk...",
  "expenseId": "exp-002",
  "expenseAmount": 15000,
  "approvalCeiling": 10000,
  "withinCeiling": false,
  "decision": "denied",
  "reason": "exceeds_ceiling"
}
```

## Demo Data

Pre-seeded expenses for the demo:

| ID | Description | Amount | Status |
|----|-------------|--------|--------|
| exp-001 | Marketing materials for Q1 campaign | $5,000 | pending |
| exp-002 | Executive retreat venue booking | $15,000 | pending |

- `exp-001` is within Alice's $10k limit (Happy Path scenario)
- `exp-002` exceeds Alice's $10k limit (Cryptographic Ceiling scenario)

## Demo Endpoints

### POST /demo/reset

Reset expense data to initial demo state.

### GET /demo/expenses

Get all expenses without authentication (for demo UI display).

### GET /demo/audit-log

Get recent expense operation audit logs.

## Implementation Requirements

1. Fetch Auth Server JWKS on startup and cache (with refresh)
2. Validate all tokens before processing requests
3. Reject expired tokens (60-second window is strict)
4. Parse scopes exactly — no fuzzy matching
5. Ceiling enforcement must be in code, not configuration
6. All operations logged with token context

## Acceptance Criteria

- [ ] Tokens are validated against Auth Server JWKS
- [ ] Expired tokens are rejected (even by 1 second)
- [ ] Missing or invalid tokens return 401
- [ ] Insufficient scope returns 403
- [ ] Approval ceiling is enforced for every approval request
- [ ] Ceiling enforcement cannot be bypassed by any request parameter
- [ ] Error messages clearly state the ceiling and requested amount
- [ ] All operations are audit logged with token claims
- [ ] Demo reset restores initial expense data
