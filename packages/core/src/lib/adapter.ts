// Adapter interfaces for @shotleybuilder/svelte-gridlite-kit
//
// These define the contract between GridLite (core) and any database backend.
// Adapters are constructed with their data source configuration and passed
// to GridLite via the `adapter` prop.

import type {
  ColumnMetadata,
  FilterNode,
  FilterLogic,
  ViewPreset,
  SortConfig,
  GroupConfig,
} from "./types.js";

// ─── Live Query Handle ──────────────────────────────────────────────────────

/**
 * Represents a live (reactive) query subscription.
 * Follows the Svelte store contract: subscribe returns an unsubscribe function.
 */
export interface LiveQueryHandle<T = Record<string, unknown>> {
  subscribe(callback: (state: LiveQueryState<T>) => void): () => void;
  refresh(): Promise<void>;
  update(query: QueryDescriptor): Promise<void>;
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

// ─── Query Descriptors ──────────────────────────────────────────────────────
//
// Structured representations of queries that GridLite passes to adapters.
// Each adapter compiles these into its native query language (SQL, fluent API, etc.).
// The adapter injects its own table/source and allowedColumns — callers don't need them.

/** Descriptor for a flat SELECT query (live or one-shot). */
export interface QueryDescriptor {
  filters?: FilterNode[];
  filterLogic?: FilterLogic;
  sorting?: SortConfig[];
  page?: number;
  pageSize?: number;
  globalSearch?: string;
  searchColumns?: string[];
}

/** Descriptor for a COUNT(*) query. */
export interface CountDescriptor {
  filters?: FilterNode[];
  filterLogic?: FilterLogic;
  globalSearch?: string;
  searchColumns?: string[];
}

/** Descriptor for a GROUP BY summary query. */
export interface GroupSummaryDescriptor {
  grouping: GroupConfig[];
  filters?: FilterNode[];
  filterLogic?: FilterLogic;
  sorting?: SortConfig[];
  page?: number;
  pageSize?: number;
  globalSearch?: string;
  searchColumns?: string[];
}

/** Descriptor for counting distinct groups. */
export interface GroupCountDescriptor {
  grouping: GroupConfig[];
  filters?: FilterNode[];
  filterLogic?: FilterLogic;
  globalSearch?: string;
  searchColumns?: string[];
}

/** Descriptor for detail rows within an expanded group. */
export interface GroupDetailDescriptor {
  groupValues: { column: string; value: unknown }[];
  filters?: FilterNode[];
  filterLogic?: FilterLogic;
  sorting?: SortConfig[];
  globalSearch?: string;
  searchColumns?: string[];
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

  // ── Query Execution ─────────────────────────────────────────────────────

  /** Create a live (reactive) query for flat row data. */
  createLiveQuery(query: QueryDescriptor): LiveQueryHandle;

  /** Execute a count query. Returns the total number of matching rows. */
  executeCount(query: CountDescriptor): Promise<number>;

  /** Execute a group summary query. Returns group header rows with aggregations. */
  executeGroupSummary(
    query: GroupSummaryDescriptor,
  ): Promise<{ rows: Record<string, unknown>[] }>;

  /** Execute a group count query. Returns how many distinct groups exist. */
  executeGroupCount(query: GroupCountDescriptor): Promise<number>;

  /** Execute a group detail query. Returns detail rows for an expanded group. */
  executeGroupDetail(
    query: GroupDetailDescriptor,
  ): Promise<{ rows: Record<string, unknown>[] }>;

  // ── State Persistence ───────────────────────────────────────────────────

  /** Load persisted column state for a grid instance. */
  loadColumnState(gridId: string, viewId?: string): Promise<ColumnStateEntry[]>;

  /** Save column state for a grid instance. */
  saveColumnState(
    gridId: string,
    columns: ColumnStateEntry[],
    viewId?: string,
  ): Promise<void>;

  // ── View Persistence ─────────────────────────────────────────────────────

  /** Save (upsert) a view configuration for a grid instance. */
  saveView(gridId: string, view: ViewPreset): Promise<void>;

  /** Load a single view by ID. Returns null if not found. */
  loadView(viewId: string): Promise<ViewPreset | null>;

  /** Load all views for a grid instance, sorted by name. */
  loadViews(gridId: string): Promise<ViewPreset[]>;

  /** Delete a view by ID (cascades to associated column state). */
  deleteView(viewId: string): Promise<void>;

  /** Load the default view for a grid instance (if one is set). */
  loadDefaultView(gridId: string): Promise<ViewPreset | null>;

  /** Set a view as the default for its grid. Clears any previous default. */
  setDefaultView(gridId: string, viewId: string): Promise<void>;

  // ── Filter Suggestions ──────────────────────────────────────────────────

  /** Fetch distinct values for a column (for autocomplete suggestions). */
  getDistinctValues(column: string): Promise<string[]>;

  /** Fetch min/max range for a numeric column. */
  getNumericRange(column: string): Promise<{ min: number; max: number } | null>;
}
