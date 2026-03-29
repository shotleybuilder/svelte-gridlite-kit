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
  QueryDescriptor,
  CountDescriptor,
  GroupSummaryDescriptor,
  GroupCountDescriptor,
  GroupDetailDescriptor,
} from "@shotleybuilder/svelte-gridlite-kit/adapter";
import type {
  ColumnMetadata,
  ViewPreset,
} from "@shotleybuilder/svelte-gridlite-kit/types";
import {
  quoteIdentifier,
  resolveFrom,
  buildQuery,
  buildCountQuery,
  buildGroupSummaryQuery,
  buildGroupCountQuery,
  buildGroupDetailQuery,
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

  // ── Private Helpers ───────────────────────────────────────────────────────

  private resolveSource(): { table?: string; source?: string } {
    return this.table ? { table: this.table } : { source: this.source };
  }

  // ── Query Execution ───────────────────────────────────────────────────────

  createLiveQuery(query: QueryDescriptor): LiveQueryHandle {
    const built = buildQuery({
      ...this.resolveSource(),
      ...query,
      allowedColumns: this.allowedColumns,
    });
    const store = createLiveQueryStore(this.db, built.sql, built.params);

    // Wrap the SQL-native store to satisfy the descriptor-based LiveQueryHandle interface
    return {
      subscribe: store.subscribe,
      refresh: store.refresh,
      update: async (newQuery: QueryDescriptor) => {
        const newBuilt = buildQuery({
          ...this.resolveSource(),
          ...newQuery,
          allowedColumns: this.allowedColumns,
        });
        await store.update(newBuilt.sql, newBuilt.params);
      },
      destroy: store.destroy,
    };
  }

  async executeCount(query: CountDescriptor): Promise<number> {
    const built = buildCountQuery({
      ...this.resolveSource(),
      ...query,
      allowedColumns: this.allowedColumns,
    });
    const result = await this.db.query<{ total: string }>(
      built.sql,
      built.params as any[],
    );
    return parseInt(result.rows[0]?.total ?? "0", 10);
  }

  async executeGroupSummary(
    query: GroupSummaryDescriptor,
  ): Promise<{ rows: Record<string, unknown>[] }> {
    const built = buildGroupSummaryQuery({
      ...this.resolveSource(),
      ...query,
      allowedColumns: this.allowedColumns,
    });
    const result = await this.db.query(built.sql, built.params as any[]);
    return { rows: result.rows as Record<string, unknown>[] };
  }

  async executeGroupCount(query: GroupCountDescriptor): Promise<number> {
    const built = buildGroupCountQuery({
      ...this.resolveSource(),
      ...query,
      allowedColumns: this.allowedColumns,
    });
    const result = await this.db.query<{ total: string }>(
      built.sql,
      built.params as any[],
    );
    return parseInt(result.rows[0]?.total ?? "0", 10);
  }

  async executeGroupDetail(
    query: GroupDetailDescriptor,
  ): Promise<{ rows: Record<string, unknown>[] }> {
    const built = buildGroupDetailQuery({
      ...this.resolveSource(),
      ...query,
      allowedColumns: this.allowedColumns,
    });
    const result = await this.db.query(built.sql, built.params as any[]);
    return { rows: result.rows as Record<string, unknown>[] };
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

  async getDistinctValues(column: string): Promise<string[]> {
    const fromClause = resolveFrom(this.table, this.source);
    const quotedCol = quoteIdentifier(column, this.allowedColumns);

    // Determine data type for JSONB detection
    const colMeta = this.columns.find((c) => c.name === column);
    const dataType = colMeta?.dataType;

    let sql: string;
    if (dataType === "json") {
      sql = `SELECT DISTINCT jsonb_object_keys(${quotedCol}) AS val FROM ${fromClause} WHERE ${quotedCol} IS NOT NULL ORDER BY val LIMIT 200`;
    } else {
      sql = `SELECT DISTINCT ${quotedCol}::TEXT AS val FROM ${fromClause} WHERE ${quotedCol} IS NOT NULL ORDER BY val LIMIT 200`;
    }

    try {
      const result = await this.db.query<{ val: string }>(sql);
      return result.rows.map((r) => r.val);
    } catch {
      return [];
    }
  }

  async getNumericRange(
    column: string,
  ): Promise<{ min: number; max: number } | null> {
    // Only query for numeric columns
    const colMeta = this.columns.find((c) => c.name === column);
    if (colMeta?.dataType !== "number") return null;

    const fromClause = resolveFrom(this.table, this.source);
    const quotedCol = quoteIdentifier(column, this.allowedColumns);

    try {
      const sql = `SELECT MIN(${quotedCol})::NUMERIC AS min_val, MAX(${quotedCol})::NUMERIC AS max_val FROM ${fromClause}`;
      const result = await this.db.query<{ min_val: string; max_val: string }>(
        sql,
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
