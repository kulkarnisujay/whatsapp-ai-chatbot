// ──────────────────────────────────────────────────────────────────────────────
// Global Error Handler Middleware
// Catches all unhandled errors and returns a clean JSON response.
// Must be registered AFTER all routes in app.ts.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';

/**
 * Express global error handling middleware.
 * Catches any unhandled errors thrown in route handlers or other middleware.
 * Returns a structured JSON error response and logs details in development mode.
 *
 * @param err - The error object
 * @param _req - Express request (unused but required by Express error handler signature)
 * @param res - Express response
 * @param _next - Express next function (unused but required by Express error handler signature)
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const isDev = process.env['NODE_ENV'] === 'development';

  // Log error details in development
  if (isDev) {
    console.error('');
    console.error('🔥 ═══════════════════════════════════════════════');
    console.error('   UNHANDLED ERROR');
    console.error('🔥 ═══════════════════════════════════════════════');
    console.error(`   Name:    ${err.name}`);
    console.error(`   Message: ${err.message}`);
    console.error(`   Stack:   ${err.stack}`);
    console.error('');
  } else {
    // In production, log only the essentials
    console.error(`🔥 Unhandled Error: ${err.message}`);
  }

  res.status(500).json({
    error: 'Internal Server Error',
    ...(isDev && {
      message: err.message,
      stack: err.stack,
    }),
  });
}
