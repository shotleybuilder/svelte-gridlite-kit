/**
 * query-translator.ts — Translates GridLite descriptors into TanStack DB query builder chains.
 *
 * Four pure functions that chain onto a BaseQueryBuilder:
 *   applyFilters     — recursive FilterNode → and/or tree
 *   applyGlobalSearch — OR of ilike across columns
 *   applySorting     — .orderBy() chain
 *   applyPagination  — .limit().offset() (requires orderBy)
 */

import { and, or, ilike, isNull, not, eq } from "@tanstack/db";
import type {
  FilterNode,
  FilterLogic,
  SortConfig,
} from "@shotleybuilder/svelte-gridlite-kit/types";
import { isFilterGroup } from "@shotleybuilder/svelte-gridlite-kit/types";
import { translateCondition } from "./operator-map.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryChain = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContextProxy = any;

/**
 * Apply filter nodes to a query chain.
 */
export function applyFilters(
  chain: QueryChain,
  filters?: FilterNode[],
  filterLogic?: FilterLogic,
): QueryChain {
  if (!filters || filters.length === 0) return chain;

  const logic = filterLogic ?? "and";

  return chain.where((ctx: ContextProxy) => {
    const source = ctx.source;
    const expressions = filters
      .map((node) => translateNode(node, source))
      .filter((e): e is NonNullable<typeof e> => e != null);

    if (expressions.length === 0) return eq(1, 1); // no-op true
    if (expressions.length === 1) return expressions[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return logic === "or"
      ? or(...(expressions as [any, any, ...any[]]))
      : and(...(expressions as [any, any, ...any[]]));
  });
}

/**
 * Recursively translate a FilterNode into a TanStack DB expression.
 */
function translateNode(node: FilterNode, source: ContextProxy): unknown | null {
  if (isFilterGroup(node)) {
    const childExprs = node.children
      .map((child) => translateNode(child, source))
      .filter((e): e is NonNullable<typeof e> => e != null);

    if (childExprs.length === 0) return null;
    if (childExprs.length === 1) return childExprs[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return node.logic === "or"
      ? or(...(childExprs as [any, any, ...any[]]))
      : and(...(childExprs as [any, any, ...any[]]));
  }

  // Leaf condition
  if (!node.field) return null;

  // JSONB operators need fn.where() fallback — skip in expression tree
  if (
    node.operator === "jsonb_has_key" ||
    node.operator === "jsonb_not_has_key"
  ) {
    // Cannot express in D2 expression tree; handled separately
    return null;
  }

  const fieldRef = source[node.field];
  return translateCondition(
    fieldRef,
    node,
    (colName: string) => source[colName],
  );
}

/**
 * Apply global search (OR of ilike across columns).
 */
export function applyGlobalSearch(
  chain: QueryChain,
  searchTerm?: string,
  searchColumns?: string[],
): QueryChain {
  if (!searchTerm || !searchColumns || searchColumns.length === 0) return chain;

  const pattern = `%${searchTerm}%`;

  return chain.where((ctx: ContextProxy) => {
    const source = ctx.source;
    const expressions = searchColumns.map((col) => ilike(source[col], pattern));
    if (expressions.length === 0) return eq(1, 1);
    if (expressions.length === 1) return expressions[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return or(...(expressions as [any, any, ...any[]]));
  });
}

/**
 * Apply sorting to a query chain.
 */
export function applySorting(
  chain: QueryChain,
  sorting?: SortConfig[],
): QueryChain {
  if (!sorting || sorting.length === 0) return chain;

  for (const sort of sorting) {
    chain = chain.orderBy(
      (ctx: ContextProxy) => ctx.source[sort.column],
      sort.direction === "desc" ? "desc" : "asc",
    );
  }
  return chain;
}

/**
 * Apply pagination (limit/offset) to a query chain.
 * TanStack DB requires orderBy for limit/offset.
 */
export function applyPagination(
  chain: QueryChain,
  page?: number,
  pageSize?: number,
  hasOrdering?: boolean,
  defaultSortColumn?: string,
): QueryChain {
  if (page == null || pageSize == null) return chain;

  // TanStack DB requires orderBy for limit/offset
  if (!hasOrdering && defaultSortColumn) {
    chain = chain.orderBy((ctx: ContextProxy) => ctx.source[defaultSortColumn]);
  }

  const offset = page * pageSize;
  chain = chain.limit(pageSize);
  if (offset > 0) {
    chain = chain.offset(offset);
  }
  return chain;
}

/**
 * Apply JSONB functional fallback filters via fn.where().
 * These cannot be expressed in the D2 expression tree.
 */
export function applyJsonbFilters(
  chain: QueryChain,
  filters?: FilterNode[],
): QueryChain {
  if (!filters) return chain;

  const jsonbConditions = collectJsonbConditions(filters);
  for (const cond of jsonbConditions) {
    if (cond.operator === "jsonb_has_key") {
      chain = chain.fn.where((row: Record<string, Record<string, unknown>>) => {
        const obj = row.source[cond.field];
        if (obj == null || typeof obj !== "object") return false;
        return String(cond.value) in (obj as Record<string, unknown>);
      });
    } else if (cond.operator === "jsonb_not_has_key") {
      chain = chain.fn.where((row: Record<string, Record<string, unknown>>) => {
        const obj = row.source[cond.field];
        if (obj == null || typeof obj !== "object") return true;
        return !(String(cond.value) in (obj as Record<string, unknown>));
      });
    }
  }
  return chain;
}

function collectJsonbConditions(
  nodes: FilterNode[],
): Array<{ field: string; operator: string; value: unknown }> {
  const result: Array<{ field: string; operator: string; value: unknown }> = [];
  for (const node of nodes) {
    if (isFilterGroup(node)) {
      result.push(...collectJsonbConditions(node.children));
    } else if (
      node.operator === "jsonb_has_key" ||
      node.operator === "jsonb_not_has_key"
    ) {
      result.push({
        field: node.field,
        operator: node.operator,
        value: node.value,
      });
    }
  }
  return result;
}
