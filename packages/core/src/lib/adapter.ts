// Adapter interfaces for @shotleybuilder/svelte-gridlite-kit
//
// These define the contract between GridLite (core) and any database backend.
// Adapters are constructed with their data source configuration and passed
// to GridLite via the `adapter` prop.

import type { ColumnMetadata, FilterNode, FilterLogic } from "./types.js";

// ─── Live Query Handle ──────────────────────────────────────────────────────

/**
 * Represents a live (reactive) query subscription.
 * Follows the Svelte store contract: subscribe returns an unsubscribe function.
 */
export interface LiveQueryHandle<T = Record<string, unknown>> {
  subscribe(callback: (state: LiveQueryState<T>) => void): () => void;
  refresh(): Promise<void>;
  update(sql: string, params?: unknown[]): Promise<void>;
  destroy(): Promise<void>;
}

export interface LiveQueryState<T = Record<string, unknown>> {
  rows: T[];
  fields: { name: string; dataTypeID: number }[];
  totalCount?: number;
  loading: boolean;
  error: Error | null;
}

// ─── Column State Entry ─────────────────────────────────────────────────────

export interface ColumnStateEntry {
  name: string;
  visible: boolean;
  width: number | null;
  position: number | null;
  label: string | null;
}

// ─── Query Adapter Interface ────────────────────────────────────────────────

/**
 * The contract between GridLite (core) and any database backend.
 *
 * Adapters are constructed with their data source configuration
 * (e.g., PGLite instance + table name). GridLite receives a
 * ready-to-use adapter via the `adapter` prop.
 */
export interface QueryAdapter {
  // ── Lifecycle ───────────────────────────────────────────────────────────

  /** Initialize the adapter: run migrations, validate connection, etc. */
  init(): Promise<void>;

  /** Clean up resources (close subscriptions, etc.). */
  destroy(): void;

  // ── Schema ──────────────────────────────────────────────────────────────

  /** Discover column metadata for the configured data source. */
  introspect(): Promise<ColumnMetadata[]>;

  /** Returns the list of safe column names (for SQL injection prevention). */
  getAllowedColumns(): string[];

  // ── Live Query (flat mode) ──────────────────────────────────────────────

  /** Create a live (reactive) query subscription. */
  createLiveQuery(sql: string, params?: unknown[]): LiveQueryHandle;

  // ── One-shot Queries ────────────────────────────────────────────────────

  /** Execute a one-shot query and return rows. */
  execute<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;

  // ── State Persistence ───────────────────────────────────────────────────

  /** Load persisted column state for a grid instance. */
  loadColumnState(gridId: string, viewId?: string): Promise<ColumnStateEntry[]>;

  /** Save column state for a grid instance. */
  saveColumnState(
    gridId: string,
    columns: ColumnStateEntry[],
    viewId?: string,
  ): Promise<void>;

  // ── Filter Suggestions ──────────────────────────────────────────────────

  /** Fetch distinct values for a column (for autocomplete suggestions). */
  getDistinctValues(
    column: string,
    options?: {
      table?: string;
      source?: string;
      filters?: FilterNode[];
      filterLogic?: FilterLogic;
      allowedColumns?: string[];
    },
  ): Promise<string[]>;

  /** Fetch min/max range for a numeric column. */
  getNumericRange(
    column: string,
    options?: {
      table?: string;
      source?: string;
      filters?: FilterNode[];
      filterLogic?: FilterLogic;
      allowedColumns?: string[];
    },
  ): Promise<{ min: number; max: number } | null>;

  // ── Query Source ────────────────────────────────────────────────────────

  /** Returns the table name if in table mode, or undefined. */
  getTable(): string | undefined;

  /** Returns the raw SQL source if in query mode, or undefined. */
  getSource(): string | undefined;
}
