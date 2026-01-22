/**
 * Express Middleware
 *
 * Common middleware for the demo services.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import cors from 'cors';
import express from 'express';

/**
 * Global error handler middleware.
 * Returns JSON errors with stack trace in development mode.
 */
export function errorHandler(
  err: Error & { status?: number; statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  console.error(`[ERROR] ${err.message}`, isDev ? err.stack : '');

  res.status(status).json({
    error: status >= 500 ? 'internal_error' : 'error',
    message: err.message,
    ...(isDev && { stack: err.stack }),
  });
}

/**
 * Request logger middleware.
 * Logs method, path, status, and timing.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`[${new Date().toISOString()}] ${method} ${path} ${statusCode} ${duration}ms`);
  });

  next();
}

/**
 * CORS middleware configured for demo.
 * Allows all origins (suitable for demo, not production).
 */
export function corsMiddleware(): RequestHandler {
  return cors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}

/**
 * JSON body parser with size limits.
 */
export function jsonBodyParser(): RequestHandler {
  return express.json({ limit: '1mb' });
}

/**
 * Health check endpoint handler.
 */
export function healthCheck(serviceName: string): RequestHandler {
  return (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: serviceName,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Not found handler for undefined routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'not_found',
    message: `Route not found: ${req.method} ${req.path}`,
  });
}

export interface TokenInfo {
  sub: string;
  scope: string;
  exp: number;
  jti: string;
  claims?: Record<string, unknown>;
}

/**
 * Extend Express Request to include token info.
 */
declare global {
  namespace Express {
    interface Request {
      token?: TokenInfo;
    }
  }
}

/**
 * Create standard Express app with common middleware.
 */
export function createApp(serviceName: string): express.Application {
  const app = express();

  // Apply common middleware
  app.use(requestLogger);
  app.use(corsMiddleware());
  app.use(jsonBodyParser());

  // Health check endpoint
  app.get('/health', healthCheck(serviceName));

  return app;
}

/**
 * Start the Express server with error handling.
 */
export function startServer(
  app: express.Application,
  port: number,
  serviceName: string
): void {
  // Error handler (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  app.listen(port, () => {
    console.log(`[${serviceName}] Server running on port ${port}`);
  });
}
