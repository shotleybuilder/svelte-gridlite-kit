/**
 * SQL Query Builder for GridLite
 *
 * Translates FilterCondition[], SortConfig[], GroupConfig[], and pagination
 * into parameterized SQL queries. All user input is parameterized — never
 * interpolated into SQL strings.
 *
 * Column names are validated against an allowlist (from schema introspection)
 * to prevent SQL injection via identifier manipulation.
 */

import type {
  FilterCondition,
  FilterLogic,
  SortConfig,
  GroupConfig,
  ParameterizedQuery,
  AggregateFunction,
} from "../types.js";

// ─── Column Name Validation ─────────────────────────────────────────────────

/**
 * Valid SQL identifier pattern: letters, digits, underscores.
 * Rejects anything that could be used for SQL injection via identifiers.
 */
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Validate and quote a column name as a SQL identifier.
 * Throws if the name is not a valid identifier.
 *
 * When `allowedColumns` is provided, also checks the name is in the allowlist.
 */
export function quoteIdentifier(
  name: string,
  allowedColumns?: string[],
): string {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new Error(`Invalid column name: ${JSON.stringify(name)}`);
  }
  if (allowedColumns && !allowedColumns.includes(name)) {
    throw new Error(`Column not found: ${JSON.stringify(name)}`);
  }
  return `"${name}"`;
}

// ─── WHERE Clause Builder ───────────────────────────────────────────────────

/**
 * Build a WHERE clause from filter conditions.
 *
 * Returns `{ sql: string, params: unknown[] }` where sql is empty string
 * if there are no valid conditions.
 *
 * @param conditions - Filter conditions from the UI
 * @param logic - 'and' or 'or' between conditions
 * @param paramOffset - Starting parameter index (for $1, $2, ...) when composing with other clauses
 * @param allowedColumns - Optional allowlist of column names from schema introspection
 */
export function buildWhereClause(
  conditions: FilterCondition[],
  logic: FilterLogic = "and",
  paramOffset: number = 0,
  allowedColumns?: string[],
): ParameterizedQuery {
  // Filter out invalid conditions
  const valid = conditions.filter(
    (c) =>
      c.field &&
      (c.operator === "is_empty" ||
        c.operator === "is_not_empty" ||
        (c.value !== null && c.value !== undefined && c.value !== "")),
  );

  if (valid.length === 0) {
    return { sql: "", params: [] };
  }

  const parts: string[] = [];
  const params: unknown[] = [];
  let paramIndex = paramOffset + 1; // PostgreSQL params are 1-indexed

  for (const condition of valid) {
    const col = quoteIdentifier(condition.field, allowedColumns);
    const result = buildConditionSQL(col, condition, paramIndex);
    parts.push(result.sql);
    params.push(...result.params);
    paramIndex += result.params.length;
  }

  const joiner = logic === "or" ? " OR " : " AND ";
  const sql = `WHERE ${parts.join(joiner)}`;

  return { sql, params };
}

/**
 * Build SQL for a single filter condition.
 */
function buildConditionSQL(
  quotedCol: string,
  condition: FilterCondition,
  paramIndex: number,
): ParameterizedQuery {
  const p = (offset: number = 0) => `$${paramIndex + offset}`;

  switch (condition.operator) {
    // String operators
    case "equals":
      return { sql: `${quotedCol} = ${p()}`, params: [condition.value] };

    case "not_equals":
      return { sql: `${quotedCol} != ${p()}`, params: [condition.value] };

    case "contains":
      return {
        sql: `${quotedCol} ILIKE '%' || ${p()} || '%'`,
        params: [condition.value],
      };

    case "not_contains":
      return {
        sql: `${quotedCol} NOT ILIKE '%' || ${p()} || '%'`,
        params: [condition.value],
      };

    case "starts_with":
      return {
        sql: `${quotedCol} ILIKE ${p()} || '%'`,
        params: [condition.value],
      };

    case "ends_with":
      return {
        sql: `${quotedCol} ILIKE '%' || ${p()}`,
        params: [condition.value],
      };

    case "is_empty":
      return { sql: `(${quotedCol} IS NULL OR ${quotedCol} = '')`, params: [] };

    case "is_not_empty":
      return {
        sql: `(${quotedCol} IS NOT NULL AND ${quotedCol} != '')`,
        params: [],
      };

    // Numeric operators
    case "greater_than":
      return { sql: `${quotedCol} > ${p()}`, params: [condition.value] };

    case "less_than":
      return { sql: `${quotedCol} < ${p()}`, params: [condition.value] };

    case "greater_or_equal":
      return { sql: `${quotedCol} >= ${p()}`, params: [condition.value] };

    case "less_or_equal":
      return { sql: `${quotedCol} <= ${p()}`, params: [condition.value] };

    // Date operators
    case "is_before":
      return { sql: `${quotedCol} < ${p()}`, params: [condition.value] };

    case "is_after":
      return { sql: `${quotedCol} > ${p()}`, params: [condition.value] };

    default:
      throw new Error(
        `Unknown filter operator: ${(condition as FilterCondition).operator}`,
      );
  }
}

// ─── ORDER BY Clause Builder ────────────────────────────────────────────────

/**
 * Build an ORDER BY clause from sort configurations.
 */
export function buildOrderByClause(
  sorting: SortConfig[],
  allowedColumns?: string[],
): string {
  if (sorting.length === 0) return "";

  const parts = sorting.map((s) => {
    const col = quoteIdentifier(s.column, allowedColumns);
    const dir = s.direction === "desc" ? "DESC" : "ASC";
    return `${col} ${dir}`;
  });

  return `ORDER BY ${parts.join(", ")}`;
}

// ─── GROUP BY Clause Builder ────────────────────────────────────────────────

const VALID_AGGREGATES: AggregateFunction[] = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
];

/**
 * Build GROUP BY clause and adjust SELECT for grouped queries.
 *
 * Returns the GROUP BY clause and the SELECT column list.
 */
export function buildGroupByClause(
  grouping: GroupConfig[],
  allowedColumns?: string[],
): { selectColumns: string; groupBy: string } {
  if (grouping.length === 0) {
    return { selectColumns: "*", groupBy: "" };
  }

  const groupCols = grouping.map((g) =>
    quoteIdentifier(g.column, allowedColumns),
  );

  const aggParts: string[] = [];
  for (const group of grouping) {
    if (group.aggregations) {
      for (const agg of group.aggregations) {
        if (!VALID_AGGREGATES.includes(agg.function)) {
          throw new Error(`Invalid aggregate function: ${agg.function}`);
        }
        const aggCol = quoteIdentifier(agg.column, allowedColumns);
        const alias = agg.alias
          ? quoteIdentifier(agg.alias)
          : `"${agg.function}_${agg.column}"`;
        aggParts.push(`${agg.function.toUpperCase()}(${aggCol}) AS ${alias}`);
      }
    }
  }

  // Always include COUNT(*) for grouped results
  aggParts.push('COUNT(*) AS "_count"');

  const selectColumns = [...groupCols, ...aggParts].join(", ");
  const groupBy = `GROUP BY ${groupCols.join(", ")}`;

  return { selectColumns, groupBy };
}

// ─── Pagination ─────────────────────────────────────────────────────────────

/**
 * Build LIMIT/OFFSET clause for pagination.
 */
export function buildPaginationClause(page: number, pageSize: number): string {
  if (pageSize <= 0) throw new Error("pageSize must be positive");
  if (page < 0) throw new Error("page must be non-negative");

  const offset = page * pageSize;
  return `LIMIT ${pageSize} OFFSET ${offset}`;
}

// ─── Full Query Builder ─────────────────────────────────────────────────────

export interface QueryOptions {
  /** Table name to query */
  table: string;

  /** Filter conditions */
  filters?: FilterCondition[];

  /** Filter logic (and/or) */
  filterLogic?: FilterLogic;

  /** Sort configuration */
  sorting?: SortConfig[];

  /** Group configuration */
  grouping?: GroupConfig[];

  /** Current page (0-indexed) */
  page?: number;

  /** Page size */
  pageSize?: number;

  /** Allowed column names (from schema introspection) */
  allowedColumns?: string[];
}

/**
 * Build a complete parameterized SELECT query from grid state.
 *
 * This is the main entry point for the query builder. It composes
 * WHERE, ORDER BY, GROUP BY, and LIMIT/OFFSET clauses into a single query.
 */
export function buildQuery(options: QueryOptions): ParameterizedQuery {
  const {
    table,
    filters = [],
    filterLogic = "and",
    sorting = [],
    grouping = [],
    page,
    pageSize,
    allowedColumns,
  } = options;

  const tableName = quoteIdentifier(table);

  // GROUP BY affects SELECT columns
  const { selectColumns, groupBy } = buildGroupByClause(
    grouping,
    allowedColumns,
  );

  // WHERE clause
  const where = buildWhereClause(filters, filterLogic, 0, allowedColumns);

  // ORDER BY clause
  const orderBy = buildOrderByClause(sorting, allowedColumns);

  // LIMIT/OFFSET clause
  const pagination =
    page !== undefined && pageSize !== undefined
      ? buildPaginationClause(page, pageSize)
      : "";

  // Compose
  const parts = [
    `SELECT ${selectColumns}`,
    `FROM ${tableName}`,
    where.sql,
    groupBy,
    orderBy,
    pagination,
  ].filter(Boolean);

  return {
    sql: parts.join(" "),
    params: where.params,
  };
}

/**
 * Build a COUNT query for pagination total.
 * Uses the same filters but no sorting/grouping/pagination.
 */
export function buildCountQuery(options: QueryOptions): ParameterizedQuery {
  const { table, filters = [], filterLogic = "and", allowedColumns } = options;

  const tableName = quoteIdentifier(table);
  const where = buildWhereClause(filters, filterLogic, 0, allowedColumns);

  const parts = [
    'SELECT COUNT(*) AS "total"',
    `FROM ${tableName}`,
    where.sql,
  ].filter(Boolean);

  return {
    sql: parts.join(" "),
    params: where.params,
  };
}
