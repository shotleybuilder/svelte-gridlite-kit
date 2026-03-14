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

// ─── Source Resolution ──────────────────────────────────────────────────────

/**
 * Resolve a FROM clause from either a table name or a raw SQL source.
 * When `source` is provided, it's used as a subquery: `(source) AS _gridlite_sub`.
 * When `table` is provided, it's quoted as an identifier: `"table"`.
 */
export function resolveFrom(table?: string, source?: string): string {
  if (source) {
    return `(${source}) AS _gridlite_sub`;
  }
  if (table) {
    return quoteIdentifier(table);
  }
  throw new Error("Either `table` or `source` must be provided");
}

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

// ─── Global Search ──────────────────────────────────────────────────────────

/**
 * Build a WHERE-compatible clause for global search across text columns.
 *
 * Generates `(col1::text ILIKE '%' || $N || '%' OR col2::text ILIKE ...)`
 * using a single parameter for the search term. The `::text` cast allows
 * searching non-text columns (numbers, dates, booleans) as strings.
 *
 * @param searchTerm - The search string
 * @param textColumns - Column names to search across
 * @param paramOffset - Starting parameter index
 * @param allowedColumns - Optional allowlist
 */
export function buildGlobalSearchClause(
  searchTerm: string,
  textColumns: string[],
  paramOffset: number = 0,
  allowedColumns?: string[],
): ParameterizedQuery {
  if (!searchTerm || textColumns.length === 0) {
    return { sql: "", params: [] };
  }

  const paramIndex = paramOffset + 1;
  const p = `$${paramIndex}`;

  const parts = textColumns.map((col) => {
    const quoted = quoteIdentifier(col, allowedColumns);
    return `${quoted}::text ILIKE '%' || ${p} || '%'`;
  });

  return {
    sql: `(${parts.join(" OR ")})`,
    params: [searchTerm],
  };
}

// ─── Grouped View Queries ───────────────────────────────────────────────────

export interface GroupSummaryOptions {
  /** Table name (mutually exclusive with `source`) */
  table?: string;
  /** Raw SQL subquery source (mutually exclusive with `table`) */
  source?: string;
  /** Group columns (max 3) */
  grouping: GroupConfig[];
  /** Filter conditions to apply before grouping */
  filters?: FilterCondition[];
  /** Filter logic */
  filterLogic?: FilterLogic;
  /** Allowed column names */
  allowedColumns?: string[];
  /** Global search term */
  globalSearch?: string;
  /** Columns to search for global search */
  searchColumns?: string[];
  /** Sorting for the group results */
  sorting?: SortConfig[];
  /** Pagination for groups */
  page?: number;
  /** Page size for groups */
  pageSize?: number;
}

/**
 * Build a query that returns distinct group values with COUNT(*) and
 * optional aggregations. Used for the group header rows.
 *
 * Example output for grouping by department with avg(salary):
 *   SELECT "department", COUNT(*) AS "_count", AVG("salary") AS "avg_salary"
 *   FROM "employees" WHERE ... GROUP BY "department" ORDER BY "department"
 */
export function buildGroupSummaryQuery(
  options: GroupSummaryOptions,
): ParameterizedQuery {
  const {
    table,
    source,
    grouping,
    filters = [],
    filterLogic = "and",
    allowedColumns,
    globalSearch,
    searchColumns,
    sorting = [],
    page,
    pageSize,
  } = options;

  if (grouping.length === 0) {
    throw new Error("buildGroupSummaryQuery requires at least one group");
  }

  const fromClause = resolveFrom(table, source);
  const { selectColumns, groupBy } = buildGroupByClause(
    grouping,
    allowedColumns,
  );

  // WHERE from filters
  const where = buildWhereClause(filters, filterLogic, 0, allowedColumns);

  // Global search
  const searchCols = searchColumns ?? allowedColumns ?? [];
  const globalSearchClause = buildGlobalSearchClause(
    globalSearch ?? "",
    searchCols,
    where.params.length,
    allowedColumns,
  );

  const allParams = [...where.params, ...globalSearchClause.params];
  let whereSQL = "";
  if (where.sql && globalSearchClause.sql) {
    whereSQL = `WHERE ${where.sql.replace(/^WHERE /, "")} AND ${globalSearchClause.sql}`;
  } else if (where.sql) {
    whereSQL = where.sql;
  } else if (globalSearchClause.sql) {
    whereSQL = `WHERE ${globalSearchClause.sql}`;
  }

  // Sort by group columns if no explicit sort, or by specified sort
  let orderBy = "";
  if (sorting.length > 0) {
    orderBy = buildOrderByClause(sorting, allowedColumns);
  } else {
    // Default: sort by group columns ascending
    const groupCols = grouping.map((g) =>
      quoteIdentifier(g.column, allowedColumns),
    );
    orderBy = `ORDER BY ${groupCols.join(", ")}`;
  }

  // Pagination on groups
  const pagination =
    page !== undefined && pageSize !== undefined
      ? buildPaginationClause(page, pageSize)
      : "";

  const parts = [
    `SELECT ${selectColumns}`,
    `FROM ${fromClause}`,
    whereSQL,
    groupBy,
    orderBy,
    pagination,
  ].filter(Boolean);

  return { sql: parts.join(" "), params: allParams };
}

/**
 * Build a count query for group summaries (how many groups exist).
 */
export function buildGroupCountQuery(
  options: GroupSummaryOptions,
): ParameterizedQuery {
  const {
    table,
    source,
    grouping,
    filters = [],
    filterLogic = "and",
    allowedColumns,
    globalSearch,
    searchColumns,
  } = options;

  if (grouping.length === 0) {
    throw new Error("buildGroupCountQuery requires at least one group");
  }

  const fromClause = resolveFrom(table, source);
  const groupCols = grouping.map((g) =>
    quoteIdentifier(g.column, allowedColumns),
  );

  const where = buildWhereClause(filters, filterLogic, 0, allowedColumns);
  const searchCols = searchColumns ?? allowedColumns ?? [];
  const globalSearchClause = buildGlobalSearchClause(
    globalSearch ?? "",
    searchCols,
    where.params.length,
    allowedColumns,
  );

  const allParams = [...where.params, ...globalSearchClause.params];
  let whereSQL = "";
  if (where.sql && globalSearchClause.sql) {
    whereSQL = `WHERE ${where.sql.replace(/^WHERE /, "")} AND ${globalSearchClause.sql}`;
  } else if (where.sql) {
    whereSQL = where.sql;
  } else if (globalSearchClause.sql) {
    whereSQL = `WHERE ${globalSearchClause.sql}`;
  }

  const parts = [
    `SELECT COUNT(*) AS "total" FROM (SELECT 1 FROM ${fromClause}`,
    whereSQL,
    `GROUP BY ${groupCols.join(", ")}`,
    `) AS "_groups"`,
  ].filter(Boolean);

  return { sql: parts.join(" "), params: allParams };
}

export interface GroupDetailOptions {
  /** Table name (mutually exclusive with `source`) */
  table?: string;
  /** Raw SQL subquery source (mutually exclusive with `table`) */
  source?: string;
  /** Values to match for parent groups: [{ column: "department", value: "Engineering" }] */
  groupValues: { column: string; value: unknown }[];
  /** Filter conditions */
  filters?: FilterCondition[];
  /** Filter logic */
  filterLogic?: FilterLogic;
  /** Sorting for child rows */
  sorting?: SortConfig[];
  /** Allowed column names */
  allowedColumns?: string[];
  /** Global search term */
  globalSearch?: string;
  /** Columns to search */
  searchColumns?: string[];
}

/**
 * Build a query that returns the detail rows for an expanded group.
 *
 * Adds WHERE constraints for each group column value on top of any
 * existing filters. Used when a user expands a group header.
 *
 * Example: grouping by department, expanded "Engineering":
 *   SELECT * FROM "employees" WHERE ... AND "department" = $N ORDER BY ...
 */
export function buildGroupDetailQuery(
  options: GroupDetailOptions,
): ParameterizedQuery {
  const {
    table,
    source,
    groupValues,
    filters = [],
    filterLogic = "and",
    sorting = [],
    allowedColumns,
    globalSearch,
    searchColumns,
  } = options;

  if (groupValues.length === 0) {
    throw new Error("buildGroupDetailQuery requires at least one group value");
  }

  const fromClause = resolveFrom(table, source);

  // Base WHERE from filters
  const where = buildWhereClause(filters, filterLogic, 0, allowedColumns);

  // Global search
  const searchCols = searchColumns ?? allowedColumns ?? [];
  const globalSearchClause = buildGlobalSearchClause(
    globalSearch ?? "",
    searchCols,
    where.params.length,
    allowedColumns,
  );

  let allParams = [...where.params, ...globalSearchClause.params];

  // Build the combined WHERE from filters + global search
  let baseWhereParts: string[] = [];
  if (where.sql) {
    baseWhereParts.push(where.sql.replace(/^WHERE /, ""));
  }
  if (globalSearchClause.sql) {
    baseWhereParts.push(globalSearchClause.sql);
  }

  // Add group value constraints
  const groupConstraints: string[] = [];
  for (const gv of groupValues) {
    const col = quoteIdentifier(gv.column, allowedColumns);
    const paramIdx = allParams.length + 1;
    if (gv.value === null) {
      groupConstraints.push(`${col} IS NULL`);
    } else {
      groupConstraints.push(`${col} = $${paramIdx}`);
      allParams = [...allParams, gv.value];
    }
  }

  const allWhereParts = [...baseWhereParts, ...groupConstraints];
  const whereSQL =
    allWhereParts.length > 0 ? `WHERE ${allWhereParts.join(" AND ")}` : "";

  const orderBy = buildOrderByClause(sorting, allowedColumns);

  const parts = [`SELECT *`, `FROM ${fromClause}`, whereSQL, orderBy].filter(
    Boolean,
  );

  return { sql: parts.join(" "), params: allParams };
}

// ─── Full Query Builder ─────────────────────────────────────────────────────

export interface QueryOptions {
  /** Table name to query (mutually exclusive with `source`) */
  table?: string;

  /** Raw SQL subquery source (mutually exclusive with `table`) */
  source?: string;

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

  /** Global search term (ILIKE across searchColumns) */
  globalSearch?: string;

  /** Columns to search for global search (defaults to all allowedColumns) */
  searchColumns?: string[];
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
    source,
    filters = [],
    filterLogic = "and",
    sorting = [],
    grouping = [],
    page,
    pageSize,
    allowedColumns,
    globalSearch,
    searchColumns,
  } = options;

  const fromClause = resolveFrom(table, source);

  // GROUP BY affects SELECT columns
  const { selectColumns, groupBy } = buildGroupByClause(
    grouping,
    allowedColumns,
  );

  // WHERE clause from filters
  const where = buildWhereClause(filters, filterLogic, 0, allowedColumns);

  // Global search clause
  const searchCols = searchColumns ?? allowedColumns ?? [];
  const globalSearchClause = buildGlobalSearchClause(
    globalSearch ?? "",
    searchCols,
    where.params.length,
    allowedColumns,
  );

  // Combine WHERE and global search
  const allParams = [...where.params, ...globalSearchClause.params];
  let whereSQL = "";
  if (where.sql && globalSearchClause.sql) {
    // Strip "WHERE " prefix from where.sql, combine with AND
    whereSQL = `WHERE ${where.sql.replace(/^WHERE /, "")} AND ${globalSearchClause.sql}`;
  } else if (where.sql) {
    whereSQL = where.sql;
  } else if (globalSearchClause.sql) {
    whereSQL = `WHERE ${globalSearchClause.sql}`;
  }

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
    `FROM ${fromClause}`,
    whereSQL,
    groupBy,
    orderBy,
    pagination,
  ].filter(Boolean);

  return {
    sql: parts.join(" "),
    params: allParams,
  };
}

/**
 * Build a COUNT query for pagination total.
 * Uses the same filters but no sorting/grouping/pagination.
 */
export function buildCountQuery(options: QueryOptions): ParameterizedQuery {
  const {
    table,
    source,
    filters = [],
    filterLogic = "and",
    allowedColumns,
    globalSearch,
    searchColumns,
  } = options;

  const fromClause = resolveFrom(table, source);
  const where = buildWhereClause(filters, filterLogic, 0, allowedColumns);

  // Global search clause
  const searchCols = searchColumns ?? allowedColumns ?? [];
  const globalSearchClause = buildGlobalSearchClause(
    globalSearch ?? "",
    searchCols,
    where.params.length,
    allowedColumns,
  );

  // Combine WHERE and global search
  const allParams = [...where.params, ...globalSearchClause.params];
  let whereSQL = "";
  if (where.sql && globalSearchClause.sql) {
    whereSQL = `WHERE ${where.sql.replace(/^WHERE /, "")} AND ${globalSearchClause.sql}`;
  } else if (where.sql) {
    whereSQL = where.sql;
  } else if (globalSearchClause.sql) {
    whereSQL = `WHERE ${globalSearchClause.sql}`;
  }

  const parts = [
    'SELECT COUNT(*) AS "total"',
    `FROM ${fromClause}`,
    whereSQL,
  ].filter(Boolean);

  return {
    sql: parts.join(" "),
    params: allParams,
  };
}
