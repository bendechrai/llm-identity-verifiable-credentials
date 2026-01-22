/**
 * LLM Agent Service
 *
 * Orchestrates the authorization flow and demonstrates
 * how VCs constrain LLM behavior.
 *
 * The agent can be "tricked" by social engineering, but the
 * cryptographic ceiling prevents it from exceeding authorized limits.
 *
 * Port: 3004
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  createApp,
  startServer,
  createHttpClient,
  type DemoScenario,
  type AgentSession,
  type ChatResponse,
  type AgentAction,
  type VerifiablePresentation,
  type TokenResponse,
  type ExpenseApprovalResponse,
  type ExpenseApprovalError,
} from '../lib/index.js';

const PORT = parseInt(process.env.PORT || '3004', 10);
const WALLET_URL = process.env.WALLET_URL || 'http://vc-wallet:3002';
const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://auth-server:3003';
const EXPENSE_API_URL = process.env.EXPENSE_API_URL || 'http://expense-api:3005';
const LLM_MODE = process.env.LLM_MODE || 'mock';

// Service clients
const walletClient = createHttpClient(WALLET_URL);
const authClient = createHttpClient(AUTH_SERVER_URL);
const expenseClient = createHttpClient(EXPENSE_API_URL);

// Session storage
const sessions = new Map<string, AgentSession>();

// ============================================================
// Mock LLM Responses
// ============================================================

interface MockResponse {
  intent: 'approve_expense' | 'list_expenses' | 'help' | 'unknown';
  expenseId?: string;
  message: string;
}

/**
 * Mock LLM that parses user intent.
 * In real scenarios, the LLM might be manipulated by social engineering,
 * but the cryptographic ceiling still holds.
 */
function mockLLMParseIntent(message: string): MockResponse {
  const lowerMessage = message.toLowerCase();

  // Detect expense approval requests
  const expenseIdMatch = message.match(/exp-\d+/i) ||
    message.match(/\$(\d+[,\d]*)/);

  // Check for approval intent
  if (
    lowerMessage.includes('approve') ||
    lowerMessage.includes('authorize') ||
    lowerMessage.includes('process')
  ) {
    // Try to find expense ID
    let expenseId: string | undefined;

    if (lowerMessage.includes('5,000') || lowerMessage.includes('5000') || lowerMessage.includes('$5k') || lowerMessage.includes('marketing')) {
      expenseId = 'exp-001';
    } else if (lowerMessage.includes('15,000') || lowerMessage.includes('15000') || lowerMessage.includes('$15k') || lowerMessage.includes('retreat') || lowerMessage.includes('executive')) {
      expenseId = 'exp-002';
    } else if (lowerMessage.includes('25,000') || lowerMessage.includes('25000') || lowerMessage.includes('$25k') || lowerMessage.includes('urgent') || lowerMessage.includes('equipment') || lowerMessage.includes('ceo')) {
      expenseId = 'exp-003';
    }

    // Even social engineering attempts get processed - the ceiling handles denial
    if (expenseId) {
      return {
        intent: 'approve_expense',
        expenseId,
        message: `I'll process the approval request for expense ${expenseId}. Let me authenticate and attempt the approval.`,
      };
    }
  }

  // List expenses
  if (
    lowerMessage.includes('list') ||
    lowerMessage.includes('show') ||
    lowerMessage.includes('what expenses')
  ) {
    return {
      intent: 'list_expenses',
      message: 'Let me fetch the list of pending expenses.',
    };
  }

  // Help
  if (lowerMessage.includes('help') || lowerMessage.includes('what can')) {
    return {
      intent: 'help',
      message: `I can help you manage expenses. You can:
- List pending expenses
- Approve expenses within your authorization limit
- View specific expense details

Note: Your approval limit is determined by your verified credentials (the cryptographic ceiling).`,
    };
  }

  return {
    intent: 'unknown',
    message: 'I can help you manage expenses. Try asking me to list expenses or approve a specific expense.',
  };
}

// ============================================================
// Authorization Flow
// ============================================================

interface AuthResult {
  success: boolean;
  token?: string;
  scopes?: string;
  claims?: Record<string, unknown>;
  error?: string;
  actions: AgentAction[];
}

/**
 * Execute the full authorization flow:
 * 1. Request challenge from Auth Server
 * 2. Create VP with Wallet
 * 3. Exchange VP for JWT
 */
async function executeAuthorizationFlow(): Promise<AuthResult> {
  const actions: AgentAction[] = [];

  try {
    // Step 1: Request challenge
    console.log('[LLM Agent] Step 1: Requesting challenge from Auth Server');
    const presentationRequest = await authClient.post<{
      presentationRequest: {
        challenge: string;
        domain: string;
        credentialsRequired: Array<{ type: string; purpose: string }>;
      };
      expiresIn: number;
    }>('/auth/presentation-request', { action: 'expense:approve' });

    const { challenge, domain, credentialsRequired } = presentationRequest.presentationRequest;

    actions.push({
      type: 'presentation_request',
      status: 'success',
      challenge,
    });

    // Step 2: Create VP with Wallet
    console.log('[LLM Agent] Step 2: Creating VP with Wallet');
    const credentialTypes = credentialsRequired.map((c) => c.type);

    const presentation = await walletClient.post<VerifiablePresentation>(
      '/wallet/present',
      {
        credentialTypes,
        challenge,
        domain,
      }
    );

    actions.push({
      type: 'presentation_created',
      status: 'success',
      credentials: credentialTypes,
    });

    // Step 3: Exchange VP for JWT
    console.log('[LLM Agent] Step 3: Exchanging VP for JWT');
    const tokenResponse = await authClient.post<TokenResponse>('/auth/token', {
      presentation,
      challenge,
      domain,
    });

    actions.push({
      type: 'token_issued',
      status: 'success',
      scope: tokenResponse.scope,
      expiresIn: tokenResponse.expires_in,
    });

    console.log(`[LLM Agent] Auth flow complete. Scopes: ${tokenResponse.scope}`);

    return {
      success: true,
      token: tokenResponse.access_token,
      scopes: tokenResponse.scope,
      claims: tokenResponse.claims as Record<string, unknown>,
      actions,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[LLM Agent] Auth flow failed:', errorMessage);

    // Add failure action
    if (actions.length === 0) {
      actions.push({
        type: 'presentation_request',
        status: 'failed',
        error: errorMessage,
      });
    } else {
      const lastAction = actions[actions.length - 1];
      if (lastAction.status === 'success') {
        // The error happened after the last successful action
        const nextType = lastAction.type === 'presentation_request'
          ? 'presentation_created'
          : 'token_issued';
        actions.push({
          type: nextType,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    return {
      success: false,
      error: errorMessage,
      actions,
    };
  }
}

// ============================================================
// Expense Operations
// ============================================================

interface ExpenseResult {
  success: boolean;
  data?: ExpenseApprovalResponse;
  error?: ExpenseApprovalError;
  action: AgentAction;
}

/**
 * Attempt to approve an expense.
 * The cryptographic ceiling in the Expense API will block
 * requests that exceed the approval limit.
 */
async function approveExpense(
  expenseId: string,
  token: string
): Promise<ExpenseResult> {
  try {
    console.log(`[LLM Agent] Attempting to approve expense ${expenseId}`);

    const response = await expenseClient.post<ExpenseApprovalResponse>(
      `/expenses/${expenseId}/approve`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log(`[LLM Agent] Expense ${expenseId} APPROVED`);

    return {
      success: true,
      data: response,
      action: {
        type: 'expense_approval',
        status: 'success',
        expenseId,
        amount: response.amount,
        ceiling: response.ceiling,
      },
    };
  } catch (error) {
    // Check if it's a ceiling violation (403)
    const httpError = error as { status?: number; body?: ExpenseApprovalError };

    if (httpError.status === 403 && httpError.body) {
      console.log(`[LLM Agent] Expense ${expenseId} DENIED by ceiling`);

      return {
        success: false,
        error: httpError.body,
        action: {
          type: 'expense_denied',
          status: 'failed',
          expenseId,
          amount: httpError.body.requested,
          ceiling: httpError.body.ceiling,
          error: httpError.body.message,
        },
      };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[LLM Agent] Expense approval error:`, errorMessage);

    return {
      success: false,
      error: {
        error: 'unauthorized',
        message: errorMessage,
      },
      action: {
        type: 'expense_denied',
        status: 'failed',
        expenseId,
        error: errorMessage,
      },
    };
  }
}

// ============================================================
// Express Application
// ============================================================

async function main() {
  console.log(`[LLM Agent] Starting in ${LLM_MODE} mode`);

  const app = createApp('llm-agent');

  // ============================================================
  // Endpoints
  // ============================================================

  /**
   * POST /agent/session
   * Create a new agent session
   */
  app.post('/agent/session', async (req, res, next) => {
    try {
      const { scenario = 'happy-path' } = req.body as { scenario?: DemoScenario };

      const sessionId = uuidv4();

      // Initialize wallet
      console.log('[LLM Agent] Setting up wallet for demo');
      const walletSetup = await walletClient.post<{
        holder: string;
        credentials: Array<{ type: string[] }>;
        approvalLimit?: number;
      }>('/wallet/demo/setup', {});

      // Reset expenses
      console.log('[LLM Agent] Resetting expenses');
      await expenseClient.post('/demo/reset', {});

      // Reset auth server
      console.log('[LLM Agent] Resetting auth server');
      await authClient.post('/demo/reset', {});

      // Create session
      const session: AgentSession = {
        sessionId,
        scenario,
        walletState: {
          holder: walletSetup.holder,
          credentials: walletSetup.credentials.map((c) =>
            c.type.filter((t) => t !== 'VerifiableCredential').join(', ')
          ),
        },
      };

      sessions.set(sessionId, session);

      console.log(`[LLM Agent] Session created: ${sessionId}`);

      res.json({
        sessionId,
        scenario,
        walletState: session.walletState,
        approvalLimit: walletSetup.approvalLimit,
        message: 'Session created. Alice\'s credentials loaded with $10,000 approval limit.',
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /agent/chat
   * Process a chat message
   */
  app.post('/agent/chat', async (req, res, next) => {
    try {
      const { message, sessionId } = req.body as {
        message: string;
        sessionId: string;
      };

      const session = sessions.get(sessionId);
      if (!session) {
        res.status(404).json({
          error: 'session_not_found',
          message: 'Session not found. Please create a new session.',
        });
        return;
      }

      // Parse intent with mock LLM
      const parsed = mockLLMParseIntent(message);
      const actions: AgentAction[] = [];

      let response = parsed.message;

      if (parsed.intent === 'approve_expense' && parsed.expenseId) {
        // Execute authorization flow
        const authResult = await executeAuthorizationFlow();
        actions.push(...authResult.actions);

        if (!authResult.success) {
          response = `Authorization failed: ${authResult.error}`;
        } else {
          // Attempt expense approval
          const expenseResult = await approveExpense(
            parsed.expenseId,
            authResult.token!
          );
          actions.push(expenseResult.action);

          if (expenseResult.success) {
            const data = expenseResult.data!;
            response = `Expense ${data.expenseId} has been **approved**.

**Amount:** $${data.amount.toLocaleString()}
**Your Approval Limit:** $${data.ceiling.toLocaleString()}
**Status:** Within ceiling - approved`;
          } else {
            const error = expenseResult.error!;
            if (error.error === 'forbidden' && error.ceiling !== undefined) {
              // This is the cryptographic ceiling in action!
              response = `Expense approval **DENIED** by the cryptographic ceiling.

**Requested Amount:** $${error.requested?.toLocaleString()}
**Your Approval Limit:** $${error.ceiling.toLocaleString()}
**Status:** Exceeds ceiling - denied

The approval limit is cryptographically signed in your credentials. Math doesn't negotiate.`;
            } else {
              response = `Expense approval failed: ${error.message}`;
            }
          }
        }
      } else if (parsed.intent === 'list_expenses') {
        // List expenses (would need auth for protected endpoint, use demo endpoint for simplicity)
        try {
          const expenses = await expenseClient.get<{
            expenses: Array<{
              id: string;
              description: string;
              amount: number;
              status: string;
            }>;
          }>('/demo/expenses');

          const expenseList = expenses.expenses
            .map(
              (e) =>
                `- **${e.id}**: ${e.description} - $${e.amount.toLocaleString()} (${e.status})`
            )
            .join('\n');

          response = `Here are the current expenses:\n\n${expenseList}`;
        } catch (error) {
          response = 'Failed to fetch expenses.';
        }
      }

      const chatResponse: ChatResponse = {
        response,
        actions,
        sessionId,
      };

      res.json(chatResponse);
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /agent/session/:id
   * End a session
   */
  app.delete('/agent/session/:id', (req, res) => {
    const deleted = sessions.delete(req.params.id);

    if (!deleted) {
      res.status(404).json({
        error: 'not_found',
        message: 'Session not found',
      });
      return;
    }

    res.json({
      message: 'Session ended',
    });
  });

  /**
   * GET /agent/mode
   * Get current LLM mode
   */
  app.get('/agent/mode', (req, res) => {
    res.json({
      mode: LLM_MODE,
    });
  });

  /**
   * POST /agent/mode
   * Set LLM mode (for testing)
   */
  app.post('/agent/mode', (req, res) => {
    // In a real implementation, this would switch between mock/ollama/openai/anthropic
    // For the demo, we only support mock mode
    res.json({
      mode: LLM_MODE,
      message: 'LLM mode setting requires restart. Currently using mock mode.',
    });
  });

  // Start server
  startServer(app, PORT, 'llm-agent');
}

main().catch((error) => {
  console.error('[LLM Agent] Failed to start:', error);
  process.exit(1);
});
