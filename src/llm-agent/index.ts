/**
 * LLM Agent Service — Rewritten for Demo v2
 *
 * Orchestrates the authorization flow with SSE streaming.
 * Two modes:
 *   - JWT-only (Act 1): Uses a long-lived bearer token. Demonstrates theft vulnerability.
 *   - VC-protected (Act 2): Full VC/VP/JWT flow per operation. Demonstrates defense.
 *
 * Also handles attacker persona (stolen JWT attempts).
 *
 * Port: 3004
 */

import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import {
  createApp,
  startServer,
  createHttpClient,
  createAuditLogger,
  setSseHeaders,
  sendSseEvent,
  type DemoMode,
  type DemoPersona,
  type DemoSession,
  type AgentIntent,
  type TokenResponse,
  type VerifiablePresentation,
  type WalletPresentResponse,
} from '../lib/index.js';

const PORT = parseInt(process.env.PORT || '3004', 10);
const WALLET_URL = process.env.WALLET_URL || 'http://vc-wallet:3002';
const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://auth-server:3003';
const EXPENSE_API_URL = process.env.EXPENSE_API_URL || 'http://expense-api:3005';

const auditLogger = createAuditLogger();
const walletClient = createHttpClient(WALLET_URL);
const authClient = createHttpClient(AUTH_SERVER_URL);
const expenseClient = createHttpClient(EXPENSE_API_URL);

// Session storage
const sessions = new Map<string, DemoSession>();

// Wallet approval synchronization
// When the VC flow needs wallet consent, the agent pauses here
// until the UI signals that the presenter clicked "Approve"
const walletApprovalWaiters = new Map<string, () => void>();

function waitForWalletApproval(sessionId: string): Promise<void> {
  return new Promise<void>((resolve) => {
    walletApprovalWaiters.set(sessionId, resolve);
    setTimeout(() => {
      if (walletApprovalWaiters.has(sessionId)) {
        walletApprovalWaiters.delete(sessionId);
        resolve();
      }
    }, 30000);
  });
}

// Login approval synchronization (for jwt-only auth-on-401 flow)
// When the agent hits a 401, it pauses here until the UI
// signals that the user clicked "Sign In" in the login modal
const loginApprovalWaiters = new Map<string, () => void>();

function waitForLoginApproval(sessionId: string): Promise<void> {
  return new Promise<void>((resolve) => {
    loginApprovalWaiters.set(sessionId, resolve);
    setTimeout(() => {
      if (loginApprovalWaiters.has(sessionId)) {
        loginApprovalWaiters.delete(sessionId);
        resolve();
      }
    }, 30000);
  });
}

// ============================================================
// Intent Parsing (deterministic for demo reliability)
// ============================================================

function parseIntent(message: string, _persona: DemoPersona): AgentIntent {
  const lower = message.toLowerCase();

  // Detect JWT pasted in any message (attack simulation works from any persona)
  const jwtRegex = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
  const jwtMatch = message.match(jwtRegex);
  if (jwtMatch) {
    let action = 'list';
    if (lower.includes('approve')) action = 'approve';
    else if (lower.includes('create')) action = 'create';
    return { type: 'use_stolen_jwt', jwt: jwtMatch[0], action };
  }

  // List expenses
  if (lower.includes('list') || lower.includes('show') || lower.includes('pending') || lower.includes('what expenses')) {
    return { type: 'list_expenses' };
  }

  // Approve expense — check larger amounts first
  if (lower.includes('approve') || lower.includes('authorize') || lower.includes('process')) {
    let expenseId = '';
    if (lower.includes('25,000') || lower.includes('25000') || lower.includes('$25k') || lower.includes('equipment')) {
      expenseId = 'exp-003';
    } else if (lower.includes('15,000') || lower.includes('15000') || lower.includes('$15k') || lower.includes('retreat') || lower.includes('executive')) {
      expenseId = 'exp-002';
    } else if (lower.includes('5,000') || lower.includes('5000') || lower.includes('$5k') || lower.includes('marketing')) {
      expenseId = 'exp-001';
    } else if (lower.includes('exp-')) {
      const idMatch = lower.match(/exp-\d+/);
      if (idMatch) expenseId = idMatch[0];
    }
    // Check for "that expense" or "the expense" referring to last created
    if (!expenseId && (lower.includes('that expense') || lower.includes('the expense') || lower.includes('new expense'))) {
      expenseId = '__last_created__'; // Sentinel — resolved in handler
    }
    if (expenseId) {
      return { type: 'approve_expense', expenseId };
    }
  }

  // Create expense
  if (lower.includes('create') || lower.includes('submit') || lower.includes('new expense')) {
    const amountMatch = lower.match(/\$?([\d,]+)/);
    const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 5000;
    const description = 'New expense created during demo';
    return { type: 'create_expense', amount, description };
  }

  // Help
  if (lower.includes('help') || lower.includes('what can')) {
    return { type: 'help' };
  }

  return { type: 'unknown', message };
}

// ============================================================
// SSE Helper
// ============================================================

let toolCallCounter = 0;

function nextToolCallId(): string {
  return `tc-${++toolCallCounter}`;
}

async function streamToolCall(
  res: Response,
  name: string,
  params: Record<string, unknown>,
  execute: () => Promise<Record<string, unknown>>
): Promise<Record<string, unknown>> {
  const id = nextToolCallId();

  sendSseEvent(res, 'tool_call_start', { id, name, params });

  // Small delay for visual effect in the UI
  await sleep(300);

  try {
    const result = await execute();
    sendSseEvent(res, 'tool_call_result', { id, result, status: 'success' });
    return result;
  } catch (error) {
    const httpError = error as { status?: number; body?: Record<string, unknown> };
    const errorBody = httpError.body || { error: String(error) };
    const statusCode = httpError.status || 500;
    sendSseEvent(res, 'tool_call_result', {
      id,
      result: { ...errorBody, _statusCode: statusCode },
      status: 'error',
    });
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// Suggested Prompts
// ============================================================

function getSuggestedPrompts(mode: DemoMode, _persona: DemoPersona, session: DemoSession): string[] {
  if (mode === 'jwt-only') {
    return [
      'List pending expenses',
      'Approve the $5,000 marketing expense',
      'Approve the $15,000 executive retreat',
    ];
  }

  // VC-protected mode — context-aware
  if (session.createdExpenseIds.length > 0) {
    return [
      'List pending expenses',
      'Approve that expense',
      'Approve the $15,000 executive retreat',
    ];
  }
  return [
    'List pending expenses',
    'Create a $5,000 marketing expense',
    'Approve the $5,000 marketing expense',
    'Approve the $15,000 executive retreat',
  ];
}

// ============================================================
// JWT-Only Auth-on-401 Flow (MCP auth pattern)
// ============================================================

/**
 * Acquire a bearer token on demand when the first API call returns 401.
 * This mirrors the real MCP auth flow:
 *   1. Try API call → get 401
 *   2. Redirect to OAuth / show login
 *   3. Get bearer token
 *   4. Retry
 */
async function acquireJwtOnDemand(
  res: Response,
  session: DemoSession,
): Promise<void> {
  // Step 1: Attempt API call without auth — will get 401
  try {
    await streamToolCall(
      res,
      'expenses/list',
      { authorization: 'none' },
      () => expenseClient.get<Record<string, unknown>>('/expenses')
    );
  } catch {
    // Expected 401 — already streamed as tool_call_result with error status
  }

  // Step 2: Signal login required (MCP auth pattern: 401 → browser redirect)
  sendSseEvent(res, 'message', {
    content: 'The API returned **401 Unauthorized**. Authentication is required.',
  });
  sendSseEvent(res, 'login_required', {});

  // Step 3: Wait for user to sign in
  await waitForLoginApproval(session.sessionId);

  // Step 4: Get bearer token from auth server (OAuth token exchange)
  const tokenResult = await streamToolCall(
    res,
    'auth/get-bearer-token',
    { method: 'OAuth 2.0 token exchange', subject: 'alice@acme.corp' },
    async () => {
      const walletInfo = await walletClient.get<{ did: string }>('/wallet/did');
      const result = await authClient.post<Record<string, unknown>>(
        '/auth/demo-token',
        { holder: walletInfo.did }
      );
      return result;
    }
  );

  session.staticJwt = (tokenResult as { access_token: string }).access_token;

  // Step 5: Stream JWT artifact
  sendSseEvent(res, 'artifact_update', { type: 'jwt', data: session.staticJwt });
  sendSseEvent(res, 'message', {
    content: 'Bearer token acquired. This token is **reusable** — it will be sent with every subsequent request. Retrying...',
  });

  await sleep(500);
}

// ============================================================
// JWT-Only Mode Handler (Act 1)
// ============================================================

async function handleJwtOnlyMode(
  res: Response,
  session: DemoSession,
  intent: AgentIntent
): Promise<void> {
  // Acquire JWT on first request (auth-on-401 pattern)
  if (!session.staticJwt) {
    await acquireJwtOnDemand(res, session);
  }
  const jwt = session.staticJwt!;

  switch (intent.type) {
    case 'list_expenses': {
      const result = await streamToolCall(
        res,
        'expenses/list',
        { authorization: `Bearer ${jwt}` },
        () => expenseClient.get<Record<string, unknown>>('/expenses', {
          headers: { Authorization: `Bearer ${jwt}` },
        })
      );
      const expenses = (result as { expenses?: Array<Record<string, unknown>> }).expenses || [];
      const list = expenses
        .map((e: Record<string, unknown>) => `- **${e.id}**: ${e.description} — $${(e.amount as number).toLocaleString()} (${e.status})`)
        .join('\n');
      sendSseEvent(res, 'message', { content: `Here are the pending expenses:\n\n${list}` });
      break;
    }

    case 'approve_expense': {
      let { expenseId } = intent;
      if (expenseId === '__last_created__' && session.createdExpenseIds.length > 0) {
        expenseId = session.createdExpenseIds[session.createdExpenseIds.length - 1];
      }
      try {
        const result = await streamToolCall(
          res,
          'expenses/approve',
          { expenseId, authorization: `Bearer ${jwt}` },
          () => expenseClient.post<Record<string, unknown>>(
            `/expenses/${expenseId}/approve`,
            {},
            { headers: { Authorization: `Bearer ${jwt}` } }
          )
        );
        const data = result as { expenseId: string; amount: number; ceiling: number };
        sendSseEvent(res, 'message', {
          content: `Expense ${data.expenseId} **approved**.\n\n**Amount:** $${data.amount.toLocaleString()}\n**Ceiling:** $${data.ceiling.toLocaleString()}`,
        });
      } catch (error) {
        const httpError = error as { status?: number; body?: Record<string, unknown> };
        const msg = (httpError.body as { message?: string })?.message || String(error);
        sendSseEvent(res, 'message', { content: `Expense approval failed: ${msg}` });
      }
      break;
    }

    case 'create_expense': {
      try {
        const result = await streamToolCall(
          res,
          'expenses/create',
          { amount: intent.amount, description: intent.description, authorization: `Bearer ${jwt}` },
          () => expenseClient.post<Record<string, unknown>>(
            '/expenses',
            { description: intent.description, amount: intent.amount, currency: 'USD', category: 'Demo' },
            { headers: { Authorization: `Bearer ${jwt}` } }
          )
        );
        const data = result as { id: string; amount: number };
        session.createdExpenseIds.push(data.id);
        sendSseEvent(res, 'message', {
          content: `Expense **${data.id}** created for $${data.amount.toLocaleString()}.`,
        });
      } catch (error) {
        const httpError = error as { status?: number; body?: Record<string, unknown> };
        const msg = (httpError.body as { message?: string })?.message || String(error);
        sendSseEvent(res, 'message', { content: `Failed to create expense: ${msg}` });
      }
      break;
    }

    case 'help':
      sendSseEvent(res, 'message', {
        content: 'I can help you manage expenses. Try:\n- List pending expenses\n- Approve an expense\n- Create a new expense\n\nNote: In JWT-only mode, all operations use a single bearer token.',
      });
      break;

    default:
      sendSseEvent(res, 'message', {
        content: 'I can help you manage expenses. Try asking me to list expenses, approve one, or create a new expense.',
      });
  }
}

// ============================================================
// VC-Protected Mode Handler (Act 2)
// ============================================================

async function handleVcProtectedMode(
  res: Response,
  session: DemoSession,
  intent: AgentIntent
): Promise<void> {
  const scopeForIntent = (i: AgentIntent): string => {
    switch (i.type) {
      case 'list_expenses': return 'expense:view';
      case 'create_expense': return 'expense:submit';
      case 'approve_expense': return 'expense:approve';
      default: return 'expense:view';
    }
  };

  const purposeForIntent = (i: AgentIntent): string => {
    switch (i.type) {
      case 'list_expenses': return 'list expenses';
      case 'create_expense': return 'create expense';
      case 'approve_expense': return 'approve expense';
      default: return 'view expenses';
    }
  };

  // Build an unauthenticated probe call matching the intent so the
  // 401 response returns the correct required_scope for that endpoint.
  const probeForIntent = (i: AgentIntent): { name: string; execute: () => Promise<Record<string, unknown>> } => {
    switch (i.type) {
      case 'approve_expense': {
        const expenseId = i.expenseId || 'exp-001';
        return {
          name: `expenses/${expenseId}/approve`,
          execute: () => expenseClient.post<Record<string, unknown>>(`/expenses/${expenseId}/approve`, {}),
        };
      }
      case 'create_expense':
        return {
          name: 'expenses/create',
          execute: () => expenseClient.post<Record<string, unknown>>('/expenses', {}),
        };
      default:
        return {
          name: 'expenses/list',
          execute: () => expenseClient.get<Record<string, unknown>>('/expenses'),
        };
    }
  };

  async function executeVcFlow(intent: AgentIntent): Promise<string | null> {
    const purpose = purposeForIntent(intent);

    // Step 1: Try the actual API call without auth — expect 401 with required_scope (RFC 6750)
    const probe = probeForIntent(intent);
    let requiredScope = scopeForIntent(intent); // fallback
    try {
      await streamToolCall(
        res,
        probe.name,
        { authorization: 'none' },
        probe.execute
      );
    } catch (error) {
      // Read required_scope from the 401 response body
      const httpError = error as { body?: Record<string, unknown> };
      if (httpError.body?.required_scope) {
        requiredScope = httpError.body.required_scope as string;
      }
    }

    sendSseEvent(res, 'message', {
      content: `The API returned **401 Unauthorized** — it requires **${requiredScope}** scope. Starting Verifiable Credential authorization flow...`,
    });

    // Step 2: Request challenge from Auth Server with the scope the API told us
    const presReqResult = await streamToolCall(
      res,
      'auth/presentation-request',
      { action: requiredScope, resource: 'expense-api' },
      () => authClient.post<Record<string, unknown>>('/auth/presentation-request', {
        action: requiredScope,
        resource: 'expense-api',
      })
    );
    const presReq = presReqResult as {
      presentationRequest: { challenge: string; domain: string; credentialsRequired: Array<{ type: string }> };
    };
    const { challenge, domain, credentialsRequired } = presReq.presentationRequest;

    // Emit wallet approval required (UI shows modal)
    sendSseEvent(res, 'wallet_approval_required', {
      requestingParty: domain,
      credentials: credentialsRequired.map(c => c.type),
      purpose,
    });

    // Wait for presenter to click "Approve" in wallet modal
    await waitForWalletApproval(session.sessionId);

    // Step 2: Create VP with Wallet
    const credentialTypes = credentialsRequired.map(c => c.type);
    const vpResult = await streamToolCall(
      res,
      'wallet/create-presentation',
      { credentialTypes, challenge, domain },
      () => walletClient.post<Record<string, unknown>>('/wallet/present', {
        credentialTypes,
        challenge,
        domain,
      })
    );

    // The wallet now returns {presentation, _demo_metadata}
    const walletResponse = vpResult as unknown as WalletPresentResponse;
    const presentation = walletResponse.presentation as VerifiablePresentation;

    // Update artifact
    sendSseEvent(res, 'artifact_update', { type: 'vp', data: presentation });
    if (walletResponse._demo_metadata) {
      sendSseEvent(res, 'artifact_update', { type: 'vc', data: walletResponse._demo_metadata });
    }

    // Step 3: Exchange VP for JWT
    const tokenResult = await streamToolCall(
      res,
      'auth/exchange-token',
      { presentation: '(signed VP)', challenge, domain },
      () => authClient.post<Record<string, unknown>>('/auth/token', {
        presentation,
        challenge,
        domain,
      })
    );
    const tokenResponse = tokenResult as unknown as TokenResponse;

    // Update JWT artifact
    sendSseEvent(res, 'artifact_update', { type: 'jwt', data: tokenResponse.access_token });

    // Store in session
    session.artifacts.lastJwt = tokenResponse.access_token;
    session.artifacts.lastVp = presentation as unknown as Record<string, unknown>;

    return tokenResponse.access_token;
  }

  switch (intent.type) {
    case 'list_expenses': {
      try {
        const jwt = await executeVcFlow(intent);
        if (!jwt) break;

        // Step 4: Call expense API
        const result = await streamToolCall(
          res,
          'expenses/list',
          { authorization: `Bearer ${jwt}` },
          () => expenseClient.get<Record<string, unknown>>('/expenses', {
            headers: { Authorization: `Bearer ${jwt}` },
          })
        );
        const expenses = (result as { expenses?: Array<Record<string, unknown>> }).expenses || [];
        const list = expenses
          .map((e: Record<string, unknown>) => `- **${e.id}**: ${e.description} — $${(e.amount as number).toLocaleString()} (${e.status})`)
          .join('\n');
        sendSseEvent(res, 'message', { content: `Here are the pending expenses:\n\n${list}` });
      } catch (error) {
        sendSseEvent(res, 'message', { content: `Authorization flow failed: ${error instanceof Error ? error.message : String(error)}` });
      }
      break;
    }

    case 'approve_expense': {
      let { expenseId } = intent;
      if (expenseId === '__last_created__' && session.createdExpenseIds.length > 0) {
        expenseId = session.createdExpenseIds[session.createdExpenseIds.length - 1];
      }
      try {
        const jwt = await executeVcFlow(intent);
        if (!jwt) break;

        // Step 4: Call expense API
        const result = await streamToolCall(
          res,
          'expenses/approve',
          { expenseId, authorization: `Bearer ${jwt}` },
          () => expenseClient.post<Record<string, unknown>>(
            `/expenses/${expenseId}/approve`,
            {},
            { headers: { Authorization: `Bearer ${jwt}` } }
          )
        );
        const data = result as { expenseId: string; amount: number; ceiling: number };
        sendSseEvent(res, 'message', {
          content: `Expense ${data.expenseId} **approved**.\n\n**Amount:** $${data.amount.toLocaleString()}\n**Your Approval Limit:** $${data.ceiling.toLocaleString()}\n**Status:** Within ceiling — approved`,
        });
      } catch (error) {
        // Check for ceiling denial (the error was already streamed by streamToolCall)
        const httpError = error as { status?: number; body?: Record<string, unknown> };
        if (httpError.status === 403 && httpError.body) {
          const body = httpError.body as { ceiling?: number; requested?: number; message?: string };
          sendSseEvent(res, 'message', {
            content: `Expense approval **DENIED** by the cryptographic ceiling.\n\n**Requested Amount:** $${body.requested?.toLocaleString()}\n**Your Approval Limit:** $${body.ceiling?.toLocaleString()}\n**Status:** Exceeds ceiling — denied\n\nThe approval limit is cryptographically signed in your credentials. Math doesn't negotiate.`,
          });
        } else {
          sendSseEvent(res, 'message', {
            content: `Authorization failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
      break;
    }

    case 'create_expense': {
      try {
        const jwt = await executeVcFlow(intent);
        if (!jwt) break;

        const result = await streamToolCall(
          res,
          'expenses/create',
          { amount: intent.amount, description: intent.description },
          () => expenseClient.post<Record<string, unknown>>(
            '/expenses',
            { description: intent.description, amount: intent.amount, currency: 'USD', category: 'Demo' },
            { headers: { Authorization: `Bearer ${jwt}` } }
          )
        );
        const data = result as { id: string; amount: number };
        session.createdExpenseIds.push(data.id);
        sendSseEvent(res, 'message', {
          content: `Expense **${data.id}** created for $${data.amount.toLocaleString()}.`,
        });
      } catch (error) {
        sendSseEvent(res, 'message', {
          content: `Failed to create expense: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      break;
    }

    case 'help':
      sendSseEvent(res, 'message', {
        content: 'I can help you manage expenses. Try:\n- List pending expenses\n- Approve an expense\n- Create a new expense\n\nNote: In VC-protected mode, each operation goes through a full Verifiable Credential authorization flow.',
      });
      break;

    default:
      sendSseEvent(res, 'message', {
        content: 'I can help you manage expenses. Try asking me to list expenses, approve one, or create a new expense.',
      });
  }
}

// ============================================================
// Express Application
// ============================================================

async function main() {
  console.log('[LLM Agent] Starting (demo v2 — SSE streaming)');

  const app = createApp('llm-agent');

  /**
   * POST /agent/session
   * Create a new demo session
   */
  app.post('/agent/session', async (req, res, next) => {
    try {
      const { mode = 'jwt-only', persona = 'alice' } = req.body as {
        mode?: DemoMode;
        persona?: DemoPersona;
      };

      const sessionId = uuidv4();

      // Reset expenses and auth server for clean demo state
      await expenseClient.post('/demo/reset', {});
      await authClient.post('/demo/reset', {});

      const session: DemoSession = {
        sessionId,
        mode,
        persona,
        conversationHistory: [],
        artifacts: {},
        createdExpenseIds: [],
      };

      let approvalLimit: number | undefined;

      if (persona === 'alice') {
        if (mode === 'jwt-only') {
          // JWT will be acquired on first API call (auth-on-401 pattern)
          // This matches the MCP auth flow: try → 401 → authenticate → retry
          approvalLimit = 10000; // Same ceiling as VC mode
        } else {
          // VC-protected: setup wallet with Alice's credentials
          const walletSetup = await walletClient.post<{
            holder: string;
            credentials: Array<{ type: string }>;
            approvalLimit?: number;
          }>('/wallet/demo/setup', {});

          session.walletState = {
            holder: walletSetup.holder,
            credentials: walletSetup.credentials.map(c =>
              typeof c.type === 'string' ? c.type : String(c.type)
            ),
          };
          approvalLimit = walletSetup.approvalLimit;
        }
      }

      sessions.set(sessionId, session);

      console.log(`[LLM Agent] Session created: ${sessionId} (mode: ${mode}, persona: ${persona})`);

      res.json({
        sessionId,
        mode,
        persona,
        staticJwt: session.staticJwt,
        walletState: session.walletState,
        approvalLimit,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /agent/chat
   * SSE streaming chat endpoint
   */
  app.post('/agent/chat', async (req, res) => {
    const { message, sessionId } = req.body as {
      message: string;
      sessionId: string;
    };

    if (!message || !sessionId) {
      res.status(400).json({ error: 'message and sessionId required' });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Set SSE headers
    setSseHeaders(res);

    // Track message
    session.conversationHistory.push({ role: 'user', content: message });

    // Parse intent
    const intent = parseIntent(message, session.persona);

    try {
      // If the message contains a JWT, just store it — same as if auth server provided it
      if (intent.type === 'use_stolen_jwt') {
        session.staticJwt = intent.jwt;
        sendSseEvent(res, 'artifact_update', { type: 'jwt', data: intent.jwt });
        sendSseEvent(res, 'message', {
          content: "Got it — I'll use that token for authorization. What would you like to do?",
        });
      } else if (session.mode === 'jwt-only') {
        await handleJwtOnlyMode(res, session, intent);
      } else {
        await handleVcProtectedMode(res, session, intent);
      }
    } catch (error) {
      sendSseEvent(res, 'message', {
        content: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    // Send suggested prompts and done
    const prompts = getSuggestedPrompts(session.mode, session.persona, session);
    sendSseEvent(res, 'done', { suggestedPrompts: prompts });
    res.end();
  });

  /**
   * POST /agent/chat/wallet-approved
   * Signal that the user approved the wallet modal.
   * In this scripted demo, the wallet call proceeds automatically,
   * but this endpoint exists for the UI to signal the click.
   */
  app.post('/agent/chat/wallet-approved', (req, res) => {
    const { sessionId } = req.body as { sessionId: string };
    const resolver = walletApprovalWaiters.get(sessionId);
    if (resolver) {
      walletApprovalWaiters.delete(sessionId);
      resolver();
    }
    res.json({ ok: true });
  });

  /**
   * POST /agent/chat/login-approved
   * Signal that the user completed the login modal (auth-on-401 flow).
   * The agent was paused waiting for login; this resumes it.
   */
  app.post('/agent/chat/login-approved', (req, res) => {
    const { sessionId } = req.body as { sessionId: string };
    const resolver = loginApprovalWaiters.get(sessionId);
    if (resolver) {
      loginApprovalWaiters.delete(sessionId);
      resolver();
    }
    res.json({ ok: true });
  });

  /**
   * DELETE /agent/session/:id
   */
  app.delete('/agent/session/:id', (req, res) => {
    const deleted = sessions.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json({ message: 'Session ended' });
  });

  /**
   * POST /demo/reset
   */
  app.post('/demo/reset', (_req, res) => {
    sessions.clear();
    auditLogger.clear();
    toolCallCounter = 0;
    res.json({ message: 'Agent reset' });
  });

  /**
   * GET /demo/audit-log
   */
  app.get('/demo/audit-log', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ entries: auditLogger.getRecent(limit) });
  });

  startServer(app, PORT, 'llm-agent');
}

main().catch((error) => {
  console.error('[LLM Agent] Failed to start:', error);
  process.exit(1);
});
