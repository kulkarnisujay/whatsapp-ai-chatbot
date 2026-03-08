// ──────────────────────────────────────────────────────────────────────────────
// Logger Utility — Consistent structured logging across all modules
// Not a full framework — just a clean wrapper for console output.
// ──────────────────────────────────────────────────────────────────────────────

const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Creates a scoped logger instance for a specific module/context.
 * All log messages are prefixed with a timestamp, log level emoji, and module name.
 *
 * @param moduleName - The name of the module (e.g., "AIService", "WhatsApp")
 * @returns A logger object with info, warn, error, and debug methods
 *
 * @example
 * ```ts
 * const log = createLogger('AIService');
 * log.info('Model initialized');
 * log.error('API call failed', error);
 * ```
 */
export function createLogger(moduleName: string) {
  function formatTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  return {
    /**
     * Logs an informational message.
     * Always visible in all environments.
     */
    info(message: string, ...args: unknown[]): void {
      console.log(`[${formatTimestamp()}] ℹ️  [${moduleName}] ${message}`, ...args);
    },

    /**
     * Logs a warning message.
     * Always visible in all environments.
     */
    warn(message: string, ...args: unknown[]): void {
      console.warn(`[${formatTimestamp()}] ⚠️  [${moduleName}] ${message}`, ...args);
    },

    /**
     * Logs an error message.
     * Always visible in all environments.
     */
    error(message: string, ...args: unknown[]): void {
      console.error(`[${formatTimestamp()}] ❌ [${moduleName}] ${message}`, ...args);
    },

    /**
     * Logs a debug message.
     * Suppressed in production environments to reduce noise.
     */
    debug(message: string, ...args: unknown[]): void {
      if (!isProduction) {
        console.log(`[${formatTimestamp()}] 🐛 [${moduleName}] ${message}`, ...args);
      }
    },
  };
}
