/**
 * adapter.ts — TanStackDBAdapter
 *
 * Implements the QueryAdapter interface using TanStack DB collections
 * and query builder. Translates structured descriptors into TanStack DB
 * query builder chains.
 */

import {
  createLiveQueryCollection,
  eq,
  isNull,
  count,
  sum,
  avg,
  min,
  max,
} from "@tanstack/db";
import type { Collection } from "@tanstack/db";
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
  applyFilters,
  applyGlobalSearch,
  applySorting,
  applyPagination,
  applyJsonbFilters,
} from "./query-translator.js";
import { createLiveQueryHandle } from "./live.js";
import { deriveColumnsFromZodSchema } from "./schema.js";
import { InMemoryStorage, type StorageProvider } from "./storage.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCollection = Collection<any, any, any, any, any>;

export interface TanStackDBAdapterOptions {
  /** TanStack DB Collection to query against */
  collection: AnyCollection;
  /** Explicit column metadata (required unless schema is provided) */
  columns?: ColumnMetadata[];
  /** Zod schema for automatic column derivation (alternative to columns) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: { shape: Record<string, any> };
  /** State persistence provider (defaults to InMemoryStorage) */
  storage?: StorageProvider;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AGG_FNS: Record<string, (arg: any) => any> = {
  count,
  sum,
  avg,
  min,
  max,
};

export class TanStackDBAdapter implements QueryAdapter {
  private collection: AnyCollection;
  private columns: ColumnMetadata[] = [];
  private allowedColumns: string[] = [];
  private storage: StorageProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private schemaOption?: { shape: Record<string, any> };
  private columnsOption?: ColumnMetadata[];
  private initialized = false;

  constructor(options: TanStackDBAdapterOptions) {
    if (!options.collection) {
      throw new Error("TanStackDBAdapter requires a collection");
    }
    if (!options.columns && !options.schema) {
      throw new Error("TanStackDBAdapter requires either columns or schema");
    }
    this.collection = options.collection;
    this.columnsOption = options.columns;
    this.schemaOption = options.schema;
    this.storage = options.storage ?? new InMemoryStorage();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    // Derive columns
    if (this.columnsOption) {
      this.columns = this.columnsOption;
    } else if (this.schemaOption) {
      this.columns = deriveColumnsFromZodSchema(this.schemaOption);
    }
    this.allowedColumns = this.columns.map((c) => c.name);
    this.initialized = true;
  }

  destroy(): void {
    // Nothing to clean up at adapter level;
    // individual live query handles clean up via their own destroy()
  }

  // ─── Schema ───────────────────────────────────────────────────────────────

  async introspect(): Promise<ColumnMetadata[]> {
    return this.columns;
  }

  getAllowedColumns(): string[] {
    return this.allowedColumns;
  }

  // ─── Query helpers ────────────────────────────────────────────────────────

  private getSearchColumns(searchColumns?: string[]): string[] {
    if (searchColumns && searchColumns.length > 0) return searchColumns;
    // Default to all text columns
    return this.columns.filter((c) => c.dataType === "text").map((c) => c.name);
  }

  private getDefaultSortColumn(): string | undefined {
    return this.allowedColumns[0];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private buildQueryFn(query: QueryDescriptor): (q: any) => any {
    const searchColumns = this.getSearchColumns(query.searchColumns);
    const defaultSortCol = this.getDefaultSortColumn();
    const hasSorting = (query.sorting?.length ?? 0) > 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (q: any) => {
      let chain = q.from({ source: this.collection });
      chain = applyFilters(chain, query.filters, query.filterLogic);
      chain = applyJsonbFilters(chain, query.filters);
      chain = applyGlobalSearch(chain, query.globalSearch, searchColumns);
      chain = applySorting(chain, query.sorting);
      chain = applyPagination(
        chain,
        query.page,
        query.pageSize,
        hasSorting,
        defaultSortCol,
      );
      return chain;
    };
  }

  // ─── Query Execution ──────────────────────────────────────────────────────

  createLiveQuery(query: QueryDescriptor): LiveQueryHandle {
    return createLiveQueryHandle({
      sourceCollection: this.collection,
      columns: this.columns,
      buildQueryFn: (desc) => this.buildQueryFn(desc),
      initialQuery: query,
    });
  }

  async executeCount(query: CountDescriptor): Promise<number> {
    const searchColumns = this.getSearchColumns(query.searchColumns);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryFn = (q: any) => {
      let chain = q.from({ source: this.collection });
      chain = applyFilters(chain, query.filters, query.filterLogic);
      chain = applyJsonbFilters(chain, query.filters);
      chain = applyGlobalSearch(chain, query.globalSearch, searchColumns);
      return chain;
    };

    const result = createLiveQueryCollection(queryFn);
    const rows = await result.toArrayWhenReady();
    return rows.length;
  }

  async executeGroupSummary(
    query: GroupSummaryDescriptor,
  ): Promise<{ rows: Record<string, unknown>[] }> {
    const searchColumns = this.getSearchColumns(query.searchColumns);
    const defaultSortCol = this.getDefaultSortColumn();
    const hasSorting = (query.sorting?.length ?? 0) > 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryFn = (q: any) => {
      let chain = q.from({ source: this.collection });
      chain = applyFilters(chain, query.filters, query.filterLogic);
      chain = applyJsonbFilters(chain, query.filters);
      chain = applyGlobalSearch(chain, query.globalSearch, searchColumns);

      // Group by
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain = chain.groupBy((ctx: any) =>
        query.grouping.map((g) => ctx.source[g.column]),
      );

      // Select: group columns + _count + aggregations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain = chain.select((ctx: any) => {
        const selected: Record<string, unknown> = {};
        for (const g of query.grouping) {
          selected[g.column] = ctx.source[g.column];
        }
        selected._count = count(ctx.source[this.allowedColumns[0]]);
        for (const g of query.grouping) {
          for (const agg of g.aggregations ?? []) {
            if (!agg.column) continue;
            const alias = agg.alias ?? `${agg.function}_${agg.column}`;
            const fn = AGG_FNS[agg.function];
            if (fn) {
              selected[alias] = fn(ctx.source[agg.column]);
            }
          }
        }
        return selected;
      });

      chain = applySorting(chain, query.sorting);
      chain = applyPagination(
        chain,
        query.page,
        query.pageSize,
        hasSorting,
        defaultSortCol,
      );
      return chain;
    };

    const result = createLiveQueryCollection(queryFn);
    const rows = await result.toArrayWhenReady();
    return { rows: rows as unknown as Record<string, unknown>[] };
  }

  async executeGroupCount(query: GroupCountDescriptor): Promise<number> {
    const searchColumns = this.getSearchColumns(query.searchColumns);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryFn = (q: any) => {
      let chain = q.from({ source: this.collection });
      chain = applyFilters(chain, query.filters, query.filterLogic);
      chain = applyJsonbFilters(chain, query.filters);
      chain = applyGlobalSearch(chain, query.globalSearch, searchColumns);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain = chain.groupBy((ctx: any) =>
        query.grouping.map((g) => ctx.source[g.column]),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain = chain.select((ctx: any) => {
        const selected: Record<string, unknown> = {};
        for (const g of query.grouping) {
          selected[g.column] = ctx.source[g.column];
        }
        return selected;
      });

      return chain;
    };

    const result = createLiveQueryCollection(queryFn);
    const rows = await result.toArrayWhenReady();
    return rows.length;
  }

  async executeGroupDetail(
    query: GroupDetailDescriptor,
  ): Promise<{ rows: Record<string, unknown>[] }> {
    const searchColumns = this.getSearchColumns(query.searchColumns);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryFn = (q: any) => {
      let chain = q.from({ source: this.collection });
      chain = applyFilters(chain, query.filters, query.filterLogic);
      chain = applyJsonbFilters(chain, query.filters);
      chain = applyGlobalSearch(chain, query.globalSearch, searchColumns);

      // Add group value constraints
      for (const gv of query.groupValues) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chain = chain.where((ctx: any) =>
          gv.value === null
            ? isNull(ctx.source[gv.column])
            : eq(ctx.source[gv.column], gv.value),
        );
      }

      chain = applySorting(chain, query.sorting);
      return chain;
    };

    const result = createLiveQueryCollection(queryFn);
    const rows = await result.toArrayWhenReady();
    return { rows: rows as unknown as Record<string, unknown>[] };
  }

  // ─── Filter Suggestions ───────────────────────────────────────────────────

  async getDistinctValues(column: string): Promise<string[]> {
    if (!this.allowedColumns.includes(column)) {
      throw new Error(`Column "${column}" is not in the allowed columns list`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryFn = (q: any) =>
      q
        .from({ source: this.collection })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select((ctx: any) => ({ val: ctx.source[column] }))
        .distinct();

    const result = createLiveQueryCollection(queryFn);
    const rows = (await result.toArrayWhenReady()) as unknown as Array<{
      val: unknown;
    }>;
    return rows
      .map((r) => r.val)
      .filter((v) => v != null)
      .map(String)
      .sort()
      .slice(0, 200);
  }

  async getNumericRange(
    column: string,
  ): Promise<{ min: number; max: number } | null> {
    if (!this.allowedColumns.includes(column)) {
      throw new Error(`Column "${column}" is not in the allowed columns list`);
    }

    const colMeta = this.columns.find((c) => c.name === column);
    if (colMeta?.dataType !== "number") return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryFn = (q: any) =>
      q
        .from({ source: this.collection })
        .groupBy(() => [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .select((ctx: any) => ({
          min_val: min(ctx.source[column]),
          max_val: max(ctx.source[column]),
        }));

    const result = createLiveQueryCollection(queryFn);
    const rows = (await result.toArrayWhenReady()) as unknown as Array<{
      min_val: number;
      max_val: number;
    }>;
    if (rows.length === 0) return null;
    return { min: Number(rows[0].min_val), max: Number(rows[0].max_val) };
  }

  // ─── State Persistence (delegated to StorageProvider) ─────────────────────

  async loadColumnState(
    gridId: string,
    viewId?: string,
  ): Promise<ColumnStateEntry[]> {
    return this.storage.loadColumnState(gridId, viewId);
  }

  async saveColumnState(
    gridId: string,
    columns: ColumnStateEntry[],
    viewId?: string,
  ): Promise<void> {
    await this.storage.saveColumnState(gridId, columns, viewId);
  }

  async saveView(gridId: string, view: ViewPreset): Promise<void> {
    await this.storage.saveView(gridId, view);
  }

  async loadView(viewId: string): Promise<ViewPreset | null> {
    return this.storage.loadView(viewId);
  }

  async loadViews(gridId: string): Promise<ViewPreset[]> {
    return this.storage.loadViews(gridId);
  }

  async deleteView(viewId: string): Promise<void> {
    await this.storage.deleteView(viewId);
  }

  async loadDefaultView(gridId: string): Promise<ViewPreset | null> {
    return this.storage.loadDefaultView(gridId);
  }

  async setDefaultView(gridId: string, viewId: string): Promise<void> {
    await this.storage.setDefaultView(gridId, viewId);
  }
}

/**
 * Factory function for creating a TanStack DB adapter.
 */
export function createTanStackDBAdapter(
  options: TanStackDBAdapterOptions,
): QueryAdapter {
  return new TanStackDBAdapter(options);
}
