/**
 * Audit Logger
 *
 * In-memory audit logging for demo transparency.
 * Tracks authorization decisions and expense operations.
 */

import type { AuditLogEntry, AuditEventType } from '../../shared/types.js';

/**
 * AuditLogger class with in-memory storage.
 * Provides structured logging for demo operations.
 */
export class AuditLogger {
  private entries: AuditLogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Log an audit entry with timestamp.
   */
  log(event: AuditEventType, details: Record<string, unknown>, requestId?: string): AuditLogEntry {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      event,
      requestId,
      details,
    };

    this.entries.push(entry);

    // Trim old entries if over limit
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Also log to console for debugging
    console.log(`[AUDIT] ${event}`, JSON.stringify(details, null, 2));

    return entry;
  }

  /**
   * Get all entries, optionally filtered.
   */
  getEntries(filter?: {
    event?: AuditEventType;
    since?: Date;
    requestId?: string;
    limit?: number;
  }): AuditLogEntry[] {
    let result = [...this.entries];

    if (filter?.event) {
      result = result.filter(e => e.event === filter.event);
    }

    if (filter?.since) {
      const sinceTime = filter.since.getTime();
      result = result.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }

    if (filter?.requestId) {
      result = result.filter(e => e.requestId === filter.requestId);
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * Get the most recent entries.
   */
  getRecent(count = 10): AuditLogEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Clear all entries (for demo reset).
   */
  clear(): void {
    this.entries = [];
    console.log('[AUDIT] Log cleared');
  }

  /**
   * Export entries to JSON.
   */
  toJSON(): AuditLogEntry[] {
    return [...this.entries];
  }

  /**
   * Get entry count.
   */
  get count(): number {
    return this.entries.length;
  }
}

// Singleton instance for shared use
let defaultLogger: AuditLogger | null = null;

/**
 * Get the default audit logger instance.
 */
export function getAuditLogger(): AuditLogger {
  if (!defaultLogger) {
    defaultLogger = new AuditLogger();
  }
  return defaultLogger;
}

/**
 * Create a new audit logger instance.
 */
export function createAuditLogger(maxEntries?: number): AuditLogger {
  return new AuditLogger(maxEntries);
}
