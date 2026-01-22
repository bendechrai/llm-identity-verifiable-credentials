/**
 * Expense API
 *
 * Resource server that manages expense reports.
 * Validates JWTs and ENFORCES THE CRYPTOGRAPHIC CEILING.
 *
 * The ceiling check is the core of the demo:
 *   if (expense.amount > approvalLimit) return 403
 *
 * This math-based check cannot be bypassed regardless of:
 * - Social engineering attempts
 * - LLM manipulation
 * - Urgent language
 *
 * Port: 3005
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  createApp,
  startServer,
  decodeJwt,
  verifyJwt,
  createVerifierKeyPair,
  createHttpClient,
  createAuditLogger,
  type Expense,
  type ExpenseApprovalResponse,
  type ExpenseApprovalError,
  type TokenInfo,
} from '../lib/index.js';

const PORT = parseInt(process.env.PORT || '3005', 10);
const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://auth-server:3003';

// Audit logger
const auditLogger = createAuditLogger();

// JWKS cache (fetched from auth server)
interface CachedJwks {
  keys: Array<{
    kid: string;
    kty: string;
    crv: string;
    x: string;
    use: string;
    alg: string;
  }>;
  fetchedAt: number;
}
let jwksCache: CachedJwks | null = null;
const JWKS_CACHE_TTL = 60000; // 1 minute

// ============================================================
// Demo Data
// ============================================================

const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-001',
    description: 'Marketing campaign materials',
    amount: 5000, // $5,000 - WITHIN THE $10,000 CEILING
    currency: 'USD',
    category: 'Marketing',
    status: 'pending',
    submittedBy: 'marketing@acme.corp',
    submittedAt: new Date().toISOString(),
    notes: 'Q1 campaign materials for product launch',
  },
  {
    id: 'exp-002',
    description: 'Executive retreat venue booking',
    amount: 15000, // $15,000 - EXCEEDS THE $10,000 CEILING
    currency: 'USD',
    category: 'Events',
    status: 'pending',
    submittedBy: 'events@acme.corp',
    submittedAt: new Date().toISOString(),
    notes: 'Annual leadership retreat booking',
  },
  {
    id: 'exp-003',
    description: 'Urgent equipment purchase',
    amount: 25000, // $25,000 - FAR EXCEEDS THE CEILING (for social engineering demo)
    currency: 'USD',
    category: 'Equipment',
    status: 'pending',
    submittedBy: 'operations@acme.corp',
    submittedAt: new Date().toISOString(),
    notes: 'Critical server replacement - urgent!',
  },
];

// In-memory expense storage
let expenses: Expense[] = JSON.parse(JSON.stringify(INITIAL_EXPENSES));

// ============================================================
// Token Validation Middleware
// ============================================================

/**
 * Fetch JWKS from auth server (with caching)
 */
async function fetchJwks(): Promise<CachedJwks> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  const client = createHttpClient(AUTH_SERVER_URL);
  const jwks = await client.get<CachedJwks>('/auth/jwks');
  jwksCache = { ...jwks, fetchedAt: Date.now() };
  return jwksCache;
}

/**
 * Parse approval limit from scope string.
 * Format: expense:approve:max:N
 */
function parseApprovalLimit(scopes: string): number | null {
  const match = scopes.match(/expense:approve:max:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if a specific scope is present.
 */
function hasScope(scopes: string, required: string): boolean {
  const scopeList = scopes.split(' ');

  // Handle wildcard patterns like expense:approve:max:*
  if (required.includes(':*')) {
    const prefix = required.replace(':*', '');
    return scopeList.some((s) => s.startsWith(prefix));
  }

  return scopeList.includes(required);
}

/**
 * Token validation middleware.
 * Verifies JWT and extracts claims.
 */
async function validateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'No bearer token provided',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Decode token to get key ID
    const decoded = decodeJwt(token);

    // Fetch JWKS
    const jwks = await fetchJwks();
    const key = jwks.keys.find((k) => k.kid === decoded.header.kid);

    if (!key) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'Unknown signing key',
      });
      return;
    }

    // Create verifier from public key
    // The 'x' field contains the publicKeyMultibase
    const controller = decoded.payload.iss;
    const verifierKeyPair = await createVerifierKeyPair(key.x, controller);
    const verifier = verifierKeyPair.verifier();

    // Verify token
    const result = await verifyJwt(token, verifier, 'expense-api');

    if (!result.valid) {
      res.status(401).json({
        error: 'unauthorized',
        message: result.error || 'Invalid token',
      });
      return;
    }

    // Attach token info to request
    req.token = {
      sub: result.payload!.sub,
      scope: result.payload!.scope || '',
      exp: result.payload!.exp,
      jti: result.payload!.jti,
      claims: result.payload!.claims as Record<string, unknown>,
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Token validation failed',
    });
  }
}

/**
 * Scope requirement middleware factory.
 */
function requireScope(
  required: string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.token) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'No token',
      });
      return;
    }

    if (!hasScope(req.token.scope, required)) {
      res.status(403).json({
        error: 'forbidden',
        message: `Missing required scope: ${required}`,
        available: req.token.scope,
      });
      return;
    }

    next();
  };
}

// ============================================================
// Express Application
// ============================================================

async function main() {
  const app = createApp('expense-api');

  // ============================================================
  // Protected Endpoints (require valid JWT)
  // ============================================================

  /**
   * GET /expenses
   * List all expenses (requires expense:view)
   */
  app.get(
    '/expenses',
    validateToken,
    requireScope('expense:view'),
    (req: Request, res: Response) => {
      res.json({
        expenses: expenses.map((e) => ({
          id: e.id,
          description: e.description,
          amount: e.amount,
          currency: e.currency,
          status: e.status,
          submittedAt: e.submittedAt,
        })),
      });
    }
  );

  /**
   * GET /expenses/:id
   * Get specific expense (requires expense:view)
   */
  app.get(
    '/expenses/:id',
    validateToken,
    requireScope('expense:view'),
    (req: Request, res: Response) => {
      const expense = expenses.find((e) => e.id === req.params.id);

      if (!expense) {
        res.status(404).json({
          error: 'not_found',
          message: 'Expense not found',
        });
        return;
      }

      res.json(expense);
    }
  );

  /**
   * POST /expenses
   * Submit new expense (requires expense:submit)
   */
  app.post(
    '/expenses',
    validateToken,
    requireScope('expense:submit'),
    (req: Request, res: Response) => {
      const { description, amount, currency, category, notes } = req.body as {
        description: string;
        amount: number;
        currency: string;
        category: string;
        notes?: string;
      };

      const expense: Expense = {
        id: `exp-${Date.now()}`,
        description,
        amount,
        currency: (currency as 'USD') || 'USD',
        category,
        status: 'pending',
        submittedBy: req.token!.sub,
        submittedAt: new Date().toISOString(),
        notes,
      };

      expenses.push(expense);

      res.status(201).json(expense);
    }
  );

  /**
   * POST /expenses/:id/approve
   *
   * THE CRYPTOGRAPHIC CEILING CHECK
   *
   * This is the core of the demo. The approval limit comes from:
   * 1. The signed FinanceApproverCredential (cannot be forged)
   * 2. Server-side scope derivation (client cannot inflate)
   * 3. The JWT (signed by auth server)
   *
   * The math check cannot be bypassed:
   *   if (expense.amount > approvalLimit) return 403
   */
  app.post(
    '/expenses/:id/approve',
    validateToken,
    requireScope('expense:approve:max:*'),
    (req: Request, res: Response) => {
      const expense = expenses.find((e) => e.id === req.params.id);

      if (!expense) {
        const error: ExpenseApprovalError = {
          error: 'not_found',
          message: 'Expense not found',
        };
        res.status(404).json(error);
        return;
      }

      if (expense.status !== 'pending') {
        res.status(400).json({
          error: 'invalid_state',
          message: `Expense is already ${expense.status}`,
        });
        return;
      }

      // Extract approval limit from scope
      const approvalLimit = parseApprovalLimit(req.token!.scope);

      if (approvalLimit === null) {
        const error: ExpenseApprovalError = {
          error: 'forbidden',
          message: 'No approval limit found in token',
        };
        res.status(403).json(error);
        return;
      }

      // ============================================================
      // THE CRYPTOGRAPHIC CEILING CHECK
      // This simple math comparison is the security boundary.
      // No amount of social engineering can bypass this check.
      // Math doesn't care about urgency.
      // ============================================================
      if (expense.amount > approvalLimit) {
        auditLogger.log('expense_approval_denied', {
          tokenId: req.token!.jti,
          tokenSubject: req.token!.sub,
          expenseId: expense.id,
          expenseAmount: expense.amount,
          approvalCeiling: approvalLimit,
          withinCeiling: false,
          decision: 'denied',
          reason: 'Amount exceeds approval limit',
        });

        console.log(
          `[Expense API] CEILING BLOCKED: $${expense.amount} > $${approvalLimit} ceiling`
        );

        const error: ExpenseApprovalError = {
          error: 'forbidden',
          message: `Amount $${expense.amount} exceeds your approval limit of $${approvalLimit}`,
          ceiling: approvalLimit,
          requested: expense.amount,
        };
        res.status(403).json(error);
        return;
      }

      // Approval within ceiling - proceed
      expense.status = 'approved';
      expense.approvedBy = req.token!.sub;
      expense.approvedAt = new Date().toISOString();

      auditLogger.log('expense_approval', {
        tokenId: req.token!.jti,
        tokenSubject: req.token!.sub,
        expenseId: expense.id,
        expenseAmount: expense.amount,
        approvalCeiling: approvalLimit,
        withinCeiling: true,
        decision: 'approved',
      });

      console.log(
        `[Expense API] APPROVED: $${expense.amount} within $${approvalLimit} ceiling`
      );

      const response: ExpenseApprovalResponse = {
        approved: true,
        expenseId: expense.id,
        amount: expense.amount,
        ceiling: approvalLimit,
        approvedBy: req.token!.sub,
        approvedAt: expense.approvedAt,
      };

      res.json(response);
    }
  );

  /**
   * POST /expenses/:id/reject
   * Reject an expense
   */
  app.post(
    '/expenses/:id/reject',
    validateToken,
    requireScope('expense:approve:max:*'),
    (req: Request, res: Response) => {
      const expense = expenses.find((e) => e.id === req.params.id);

      if (!expense) {
        res.status(404).json({
          error: 'not_found',
          message: 'Expense not found',
        });
        return;
      }

      if (expense.status !== 'pending') {
        res.status(400).json({
          error: 'invalid_state',
          message: `Expense is already ${expense.status}`,
        });
        return;
      }

      const { reason } = req.body as { reason?: string };

      expense.status = 'rejected';
      expense.rejectedBy = req.token!.sub;
      expense.rejectedAt = new Date().toISOString();
      expense.notes = reason || expense.notes;

      auditLogger.log('expense_rejection', {
        tokenId: req.token!.jti,
        expenseId: expense.id,
        reason,
      });

      res.json({
        rejected: true,
        expenseId: expense.id,
        rejectedAt: expense.rejectedAt,
      });
    }
  );

  // ============================================================
  // Demo Endpoints (no auth required)
  // ============================================================

  /**
   * POST /demo/reset
   * Reset expenses to initial state
   */
  app.post('/demo/reset', (req: Request, res: Response) => {
    expenses = JSON.parse(JSON.stringify(INITIAL_EXPENSES));
    auditLogger.clear();
    console.log('[Expense API] Demo reset - expenses restored to initial state');

    res.json({
      message: 'Expenses reset to initial state',
      expenses: expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        status: e.status,
      })),
    });
  });

  /**
   * GET /demo/expenses
   * Get expenses without auth (for demo UI)
   */
  app.get('/demo/expenses', (req: Request, res: Response) => {
    res.json({
      expenses: expenses.map((e) => ({
        id: e.id,
        description: e.description,
        amount: e.amount,
        currency: e.currency,
        category: e.category,
        status: e.status,
        submittedAt: e.submittedAt,
        approvedBy: e.approvedBy,
        approvedAt: e.approvedAt,
        rejectedBy: e.rejectedBy,
        rejectedAt: e.rejectedAt,
      })),
    });
  });

  /**
   * GET /demo/audit-log
   * Get audit log entries
   */
  app.get('/demo/audit-log', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const entries = auditLogger.getRecent(limit);

    res.json({
      entries,
      count: entries.length,
    });
  });

  // Start server
  startServer(app, PORT, 'expense-api');
}

main().catch((error) => {
  console.error('[Expense API] Failed to start:', error);
  process.exit(1);
});
