/**
 * PGLite Adapter for GridLite
 *
 * Implements the QueryAdapter interface using PGLite as the database backend.
 * Wraps all PGLite-specific operations: live queries, schema introspection,
 * state persistence, and filter suggestions.
 */

import type { PGlite } from "@electric-sql/pglite";
import type { LiveNamespace } from "@electric-sql/pglite/live";
import type {
  QueryAdapter,
  LiveQueryHandle,
  ColumnStateEntry,
} from "@shotleybuilder/svelte-gridlite-kit/adapter";
import type {
  ColumnMetadata,
  FilterNode,
  FilterLogic,
  ViewPreset,
} from "@shotleybuilder/svelte-gridlite-kit/types";
import {
  quoteIdentifier,
  resolveFrom,
  buildWhereClauseFromNodes,
} from "@shotleybuilder/svelte-gridlite-kit/builder";

import { createLiveQueryStore, type PGliteWithLive } from "./live.js";
import { introspectTable } from "./schema.js";
import { runMigrations } from "./migrations.js";
import {
  loadColumnState as loadColumnStateFromDb,
  saveColumnState as saveColumnStateFromDb,
  saveView as saveViewToDb,
  loadView as loadViewFromDb,
  loadViews as loadViewsFromDb,
  deleteView as deleteViewFromDb,
  loadDefaultView as loadDefaultViewFromDb,
  setDefaultView as setDefaultViewFromDb,
} from "./views.js";

// ─── Options ────────────────────────────────────────────────────────────────

export interface PGLiteAdapterOptions {
  /** PGLite instance with the live extension loaded */
  db: PGliteWithLive;
  /** Table name (mutually exclusive with `query`) */
  table?: string;
  /** Raw SQL query (mutually exclusive with `table`) */
  query?: string;
}

export { PGliteWithLive };

// ─── Adapter Implementation ─────────────────────────────────────────────────

export class PGLiteAdapter implements QueryAdapter {
  private db: PGliteWithLive;
  private table: string | undefined;
  private source: string | undefined;
  private allowedColumns: string[] = [];
  private columns: ColumnMetadata[] = [];

  constructor(options: PGLiteAdapterOptions) {
    if (!options.db) throw new Error("PGLiteAdapter requires a db instance");
    if (!options.table && !options.query) {
      throw new Error("PGLiteAdapter requires either table or query");
    }
    if (options.table && options.query) {
      throw new Error("PGLiteAdapter: table and query are mutually exclusive");
    }

    this.db = options.db;
    this.table = options.table;
    this.source = options.query;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    await runMigrations(this.db);

    if (this.table) {
      this.columns = await introspectTable(this.db, this.table);
      this.allowedColumns = this.columns.map((c) => c.name);
    }
  }

  destroy(): void {
    // PGLite instance is owned by the consumer, not us
  }

  // ── Schema ────────────────────────────────────────────────────────────────

  async introspect(): Promise<ColumnMetadata[]> {
    return this.columns;
  }

  getAllowedColumns(): string[] {
    return this.allowedColumns;
  }

  /**
   * Update columns and allowedColumns from query result fields.
   * Called by GridLite when in raw query mode after the first result.
   */
  setColumnsFromResult(columns: ColumnMetadata[]): void {
    this.columns = columns;
    this.allowedColumns = columns.map((c) => c.name);
  }

  // ── Live Query ────────────────────────────────────────────────────────────

  createLiveQuery(sql: string, params?: unknown[]): LiveQueryHandle {
    return createLiveQueryStore(this.db, sql, params ?? []);
  }

  // ── One-shot Queries ──────────────────────────────────────────────────────

  async execute<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }> {
    const result = await this.db.query<T>(sql, (params ?? []) as any[]);
    return { rows: result.rows };
  }

  // ── State Persistence ─────────────────────────────────────────────────────

  async loadColumnState(
    gridId: string,
    viewId?: string,
  ): Promise<ColumnStateEntry[]> {
    const rows = await loadColumnStateFromDb(this.db, gridId, viewId);
    return rows.map((r) => ({
      name: r.name,
      visible: r.visible,
      width: r.width ?? null,
      position: r.position ?? null,
      label: r.label ?? null,
    }));
  }

  async saveColumnState(
    gridId: string,
    columns: ColumnStateEntry[],
    viewId?: string,
  ): Promise<void> {
    await saveColumnStateFromDb(
      this.db,
      gridId,
      columns.map((c) => ({
        name: c.name,
        visible: c.visible,
        width: c.width ?? undefined,
        position: c.position ?? undefined,
        label: c.label,
      })),
      viewId,
    );
  }

  // ── View Persistence ───────────────────────────────────────────────────────

  async saveView(gridId: string, view: ViewPreset): Promise<void> {
    await saveViewToDb(this.db, gridId, view);
  }

  async loadView(viewId: string): Promise<ViewPreset | null> {
    return loadViewFromDb(this.db, viewId);
  }

  async loadViews(gridId: string): Promise<ViewPreset[]> {
    return loadViewsFromDb(this.db, gridId);
  }

  async deleteView(viewId: string): Promise<void> {
    await deleteViewFromDb(this.db, viewId);
  }

  async loadDefaultView(gridId: string): Promise<ViewPreset | null> {
    return loadDefaultViewFromDb(this.db, gridId);
  }

  async setDefaultView(gridId: string, viewId: string): Promise<void> {
    await setDefaultViewFromDb(this.db, gridId, viewId);
  }

  // ── Filter Suggestions ────────────────────────────────────────────────────

  async getDistinctValues(
    column: string,
    options?: {
      table?: string;
      source?: string;
      filters?: FilterNode[];
      filterLogic?: FilterLogic;
      allowedColumns?: string[];
    },
  ): Promise<string[]> {
    const tbl = options?.table ?? this.table;
    const src = options?.source ?? this.source;
    const cols = options?.allowedColumns ?? this.allowedColumns;

    const fromClause = resolveFrom(tbl, src);
    const quotedCol = quoteIdentifier(column, cols);

    // Determine data type for JSONB detection
    const colMeta = this.columns.find((c) => c.name === column);
    const dataType = colMeta?.dataType;

    let extraWhere = "";
    let whereParams: unknown[] = [];
    if (options?.filters && options.filters.length > 0) {
      const built = buildWhereClauseFromNodes(
        options.filters,
        options.filterLogic ?? "and",
        0,
        cols,
      );
      if (built.sql) {
        // built.sql is "WHERE ..." — strip the WHERE prefix and add as AND
        const clause = built.sql.replace(/^WHERE\s+/i, "");
        extraWhere = ` AND ${clause}`;
        whereParams = built.params;
      }
    }

    let sql: string;
    if (dataType === "json") {
      sql = `SELECT DISTINCT jsonb_object_keys(${quotedCol}) AS val FROM ${fromClause} WHERE ${quotedCol} IS NOT NULL${extraWhere} ORDER BY val LIMIT 200`;
    } else {
      sql = `SELECT DISTINCT ${quotedCol}::TEXT AS val FROM ${fromClause} WHERE ${quotedCol} IS NOT NULL${extraWhere} ORDER BY val LIMIT 200`;
    }

    try {
      const result = await this.db.query<{ val: string }>(
        sql,
        whereParams as any[],
      );
      return result.rows.map((r) => r.val);
    } catch {
      return [];
    }
  }

  async getNumericRange(
    column: string,
    options?: {
      table?: string;
      source?: string;
      filters?: FilterNode[];
      filterLogic?: FilterLogic;
      allowedColumns?: string[];
    },
  ): Promise<{ min: number; max: number } | null> {
    const tbl = options?.table ?? this.table;
    const src = options?.source ?? this.source;
    const cols = options?.allowedColumns ?? this.allowedColumns;

    // Only query for numeric columns
    const colMeta = this.columns.find((c) => c.name === column);
    if (colMeta?.dataType !== "number") return null;

    const fromClause = resolveFrom(tbl, src);
    const quotedCol = quoteIdentifier(column, cols);

    let whereClause = "";
    let whereParams: unknown[] = [];
    if (options?.filters && options.filters.length > 0) {
      const built = buildWhereClauseFromNodes(
        options.filters,
        options.filterLogic ?? "and",
        0,
        cols,
      );
      if (built.sql) {
        whereClause = ` ${built.sql}`;
        whereParams = built.params;
      }
    }

    try {
      const sql = `SELECT MIN(${quotedCol})::NUMERIC AS min_val, MAX(${quotedCol})::NUMERIC AS max_val FROM ${fromClause}${whereClause}`;
      const result = await this.db.query<{ min_val: string; max_val: string }>(
        sql,
        whereParams as any[],
      );
      const row = result.rows[0];
      if (row && row.min_val != null && row.max_val != null) {
        return { min: Number(row.min_val), max: Number(row.max_val) };
      }
      return null;
    } catch {
      return null;
    }
  }

  // ── Query Source ──────────────────────────────────────────────────────────

  getTable(): string | undefined {
    return this.table;
  }

  getSource(): string | undefined {
    return this.source;
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

/**
 * Create a QueryAdapter backed by PGLite.
 *
 * Usage:
 *   const adapter = createPGLiteAdapter({ db, table: 'employees' });
 *   <GridLite {adapter} ... />
 */
export function createPGLiteAdapter(
  options: PGLiteAdapterOptions,
): QueryAdapter {
  return new PGLiteAdapter(options);
}
