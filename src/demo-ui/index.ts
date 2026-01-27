/**
 * Demo UI Service
 *
 * Serves the static demo UI and proxies API calls to backend services.
 * The proxy avoids CORS issues by keeping all requests on the same origin.
 *
 * Port: 3000
 */

import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';
import {
  createApp,
  startServer,
} from '../lib/index.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const AGENT_HOST = process.env.AGENT_HOST || 'llm-agent';
const AGENT_PORT = parseInt(process.env.AGENT_PORT || '3004', 10);
const AUTH_HOST = process.env.AUTH_HOST || 'auth-server';
const AUTH_PORT = parseInt(process.env.AUTH_PORT || '3003', 10);
const EXPENSE_HOST = process.env.EXPENSE_HOST || 'expense-api';
const EXPENSE_PORT = parseInt(process.env.EXPENSE_PORT || '3005', 10);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Proxy an incoming Express request to an upstream service.
 * Works for both JSON responses and SSE streams (pipes raw bytes).
 */
function proxyRequest(
  req: Request,
  res: Response,
  hostname: string,
  port: number,
  targetPath: string
): void {
  const options: http.RequestOptions = {
    hostname,
    port,
    path: targetPath,
    method: req.method,
    headers: {
      'content-type': req.headers['content-type'] || 'application/json',
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const headers: Record<string, string | string[]> = {};
    for (const [key, val] of Object.entries(proxyRes.headers)) {
      if (val !== undefined) {
        headers[key] = val as string | string[];
      }
    }
    res.writeHead(proxyRes.statusCode || 200, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Demo UI] Proxy error: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({ error: 'proxy_error', message: err.message });
    }
  });

  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    proxyReq.write(JSON.stringify(req.body));
  }
  proxyReq.end();
}

async function main() {
  const app = createApp('demo-ui');

  // ── Agent API proxy ──────────────────────────────────────
  app.post('/api/agent/session', (req, res) => {
    proxyRequest(req, res, AGENT_HOST, AGENT_PORT, '/agent/session');
  });

  app.post('/api/agent/chat', (req, res) => {
    proxyRequest(req, res, AGENT_HOST, AGENT_PORT, '/agent/chat');
  });

  app.post('/api/agent/chat/wallet-approved', (req, res) => {
    proxyRequest(req, res, AGENT_HOST, AGENT_PORT, '/agent/chat/wallet-approved');
  });

  app.post('/api/agent/chat/login-approved', (req, res) => {
    proxyRequest(req, res, AGENT_HOST, AGENT_PORT, '/agent/chat/login-approved');
  });



  app.delete('/api/agent/session/:id', (req, res) => {
    proxyRequest(req, res, AGENT_HOST, AGENT_PORT, `/agent/session/${req.params.id}`);
  });

  // ── Demo endpoints proxy ─────────────────────────────────
  app.post('/api/demo/reset', (req, res) => {
    proxyRequest(req, res, AGENT_HOST, AGENT_PORT, '/demo/reset');
  });

  app.get('/api/demo/audit-log', (req, res) => {
    const limit = req.query.limit || '50';
    proxyRequest(req, res, EXPENSE_HOST, EXPENSE_PORT, `/demo/audit-log?limit=${limit}`);
  });

  app.get('/api/demo/expenses', (req, res) => {
    proxyRequest(req, res, EXPENSE_HOST, EXPENSE_PORT, '/demo/expenses');
  });

  // ── Static files ─────────────────────────────────────────
  const { default: express } = await import('express');
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  startServer(app, PORT, 'demo-ui');
}

main().catch((error) => {
  console.error('[Demo UI] Failed to start:', error);
  process.exit(1);
});
