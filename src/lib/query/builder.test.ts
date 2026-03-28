import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  quoteIdentifier,
  resolveFrom,
  buildWhereClause,
  buildWhereClauseFromNodes,
  buildOrderByClause,
  buildGroupByClause,
  buildPaginationClause,
  buildGlobalSearchClause,
  buildGroupSummaryQuery,
  buildGroupCountQuery,
  buildGroupDetailQuery,
  buildQuery,
  buildCountQuery,
} from "./builder.js";
import type {
  FilterCondition,
  FilterNode,
  FilterGroup,
  SortConfig,
  GroupConfig,
} from "../types.js";

// ─── Helper ─────────────────────────────────────────────────────────────────

function fc(
  field: string,
  operator: FilterCondition["operator"],
  value: unknown = "",
): FilterCondition {
  return { id: `test-${field}-${operator}`, field, operator, value };
}

/** Helper for column-comparison conditions */
function fcc(
  field: string,
  operator: FilterCondition["operator"],
  valueColumn: string,
  intervalOffset?: string,
): FilterCondition {
  return {
    id: `test-${field}-${operator}-col`,
    field,
    operator,
    value: "",
    valueColumn,
    intervalOffset,
  };
}

// ─── quoteIdentifier ────────────────────────────────────────────────────────

describe("quoteIdentifier", () => {
  it("quotes a valid identifier", () => {
    expect(quoteIdentifier("name")).toBe('"name"');
    expect(quoteIdentifier("user_id")).toBe('"user_id"');
    expect(quoteIdentifier("_private")).toBe('"_private"');
    expect(quoteIdentifier("Col1")).toBe('"Col1"');
  });

  it("rejects invalid identifiers", () => {
    expect(() => quoteIdentifier("")).toThrow("Invalid column name");
    expect(() => quoteIdentifier("1bad")).toThrow("Invalid column name");
    expect(() => quoteIdentifier("name; DROP TABLE")).toThrow(
      "Invalid column name",
    );
    expect(() => quoteIdentifier('col"umn')).toThrow("Invalid column name");
    expect(() => quoteIdentifier("col'umn")).toThrow("Invalid column name");
    expect(() => quoteIdentifier("col name")).toThrow("Invalid column name");
    expect(() => quoteIdentifier("col-name")).toThrow("Invalid column name");
  });

  it("rejects columns not in allowlist", () => {
    const allowed = ["name", "age"];
    expect(quoteIdentifier("name", allowed)).toBe('"name"');
    expect(() => quoteIdentifier("email", allowed)).toThrow("Column not found");
  });

  it("skips allowlist validation when allowedColumns is empty", () => {
    expect(quoteIdentifier("any_column", [])).toBe('"any_column"');
  });
});

// ─── buildWhereClause — String operators ────────────────────────────────────

describe("buildWhereClause — string operators", () => {
  it("equals", () => {
    const result = buildWhereClause([fc("name", "equals", "Alice")]);
    expect(result.sql).toBe('WHERE "name" = $1');
    expect(result.params).toEqual(["Alice"]);
  });

  it("not_equals", () => {
    const result = buildWhereClause([fc("name", "not_equals", "Bob")]);
    expect(result.sql).toBe('WHERE "name" != $1');
    expect(result.params).toEqual(["Bob"]);
  });

  it("contains (ILIKE)", () => {
    const result = buildWhereClause([fc("name", "contains", "ali")]);
    expect(result.sql).toBe(`WHERE "name" ILIKE '%' || $1 || '%'`);
    expect(result.params).toEqual(["ali"]);
  });

  it("not_contains", () => {
    const result = buildWhereClause([fc("name", "not_contains", "test")]);
    expect(result.sql).toBe(`WHERE "name" NOT ILIKE '%' || $1 || '%'`);
    expect(result.params).toEqual(["test"]);
  });

  it("starts_with", () => {
    const result = buildWhereClause([fc("name", "starts_with", "A")]);
    expect(result.sql).toBe(`WHERE "name" ILIKE $1 || '%'`);
    expect(result.params).toEqual(["A"]);
  });

  it("ends_with", () => {
    const result = buildWhereClause([fc("name", "ends_with", "son")]);
    expect(result.sql).toBe(`WHERE "name" ILIKE '%' || $1`);
    expect(result.params).toEqual(["son"]);
  });

  it("is_empty (no params)", () => {
    const result = buildWhereClause([fc("name", "is_empty")]);
    expect(result.sql).toBe(`WHERE ("name" IS NULL OR "name"::text = '')`);
    expect(result.params).toEqual([]);
  });

  it("is_not_empty (no params)", () => {
    const result = buildWhereClause([fc("name", "is_not_empty")]);
    expect(result.sql).toBe(
      `WHERE ("name" IS NOT NULL AND "name"::text != '')`,
    );
    expect(result.params).toEqual([]);
  });
});

// ─── buildWhereClause — Numeric operators ───────────────────────────────────

describe("buildWhereClause — numeric operators", () => {
  it("greater_than", () => {
    const result = buildWhereClause([fc("age", "greater_than", 30)]);
    expect(result.sql).toBe('WHERE "age" > $1');
    expect(result.params).toEqual([30]);
  });

  it("less_than", () => {
    const result = buildWhereClause([fc("age", "less_than", 18)]);
    expect(result.sql).toBe('WHERE "age" < $1');
    expect(result.params).toEqual([18]);
  });

  it("greater_or_equal", () => {
    const result = buildWhereClause([fc("age", "greater_or_equal", 21)]);
    expect(result.sql).toBe('WHERE "age" >= $1');
    expect(result.params).toEqual([21]);
  });

  it("less_or_equal", () => {
    const result = buildWhereClause([fc("age", "less_or_equal", 65)]);
    expect(result.sql).toBe('WHERE "age" <= $1');
    expect(result.params).toEqual([65]);
  });
});

// ─── buildWhereClause — Date operators ──────────────────────────────────────

describe("buildWhereClause — date operators", () => {
  it("is_before", () => {
    const result = buildWhereClause([
      fc("created_at", "is_before", "2024-01-01"),
    ]);
    expect(result.sql).toBe('WHERE "created_at" < $1');
    expect(result.params).toEqual(["2024-01-01"]);
  });

  it("is_after", () => {
    const result = buildWhereClause([
      fc("created_at", "is_after", "2024-06-15"),
    ]);
    expect(result.sql).toBe('WHERE "created_at" > $1');
    expect(result.params).toEqual(["2024-06-15"]);
  });
});

// ─── buildWhereClause — JSONB operators ─────────────────────────────────────

describe("buildWhereClause — JSONB operators", () => {
  it("jsonb_has_key", () => {
    const result = buildWhereClause([fc("data", "jsonb_has_key", "Making")]);
    expect(result.sql).toBe('WHERE "data" ? $1::text');
    expect(result.params).toEqual(["Making"]);
  });

  it("jsonb_not_has_key", () => {
    const result = buildWhereClause([
      fc("data", "jsonb_not_has_key", "Making"),
    ]);
    expect(result.sql).toBe('WHERE NOT ("data" ? $1::text)');
    expect(result.params).toEqual(["Making"]);
  });

  it("jsonb_has_key combined with other conditions", () => {
    const result = buildWhereClause([
      fc("active", "equals", true),
      fc("tags", "jsonb_has_key", "urgent"),
    ]);
    expect(result.sql).toBe('WHERE "active" = $1 AND "tags" ? $2::text');
    expect(result.params).toEqual([true, "urgent"]);
  });

  it("jsonb_has_key parameterizes value (SQL injection safe)", () => {
    const malicious = "'; DROP TABLE users;--";
    const result = buildWhereClause([fc("data", "jsonb_has_key", malicious)]);
    expect(result.sql).toBe('WHERE "data" ? $1::text');
    expect(result.params).toEqual([malicious]);
    expect(result.sql).not.toContain(malicious);
  });
});

// ─── buildWhereClause — Logic and edge cases ────────────────────────────────

describe("buildWhereClause — compound and edge cases", () => {
  it("returns empty for no conditions", () => {
    const result = buildWhereClause([]);
    expect(result.sql).toBe("");
    expect(result.params).toEqual([]);
  });

  it("skips conditions with empty value (except is_empty/is_not_empty)", () => {
    const result = buildWhereClause([
      fc("name", "equals", ""),
      fc("name", "contains", null),
      fc("name", "is_empty"),
    ]);
    expect(result.sql).toBe(`WHERE ("name" IS NULL OR "name"::text = '')`);
    expect(result.params).toEqual([]);
  });

  it("AND logic (default)", () => {
    const result = buildWhereClause([
      fc("name", "equals", "Alice"),
      fc("age", "greater_than", 25),
    ]);
    expect(result.sql).toBe('WHERE "name" = $1 AND "age" > $2');
    expect(result.params).toEqual(["Alice", 25]);
  });

  it("OR logic", () => {
    const result = buildWhereClause(
      [fc("name", "equals", "Alice"), fc("name", "equals", "Bob")],
      "or",
    );
    expect(result.sql).toBe('WHERE "name" = $1 OR "name" = $2');
    expect(result.params).toEqual(["Alice", "Bob"]);
  });

  it("paramOffset shifts parameter indices", () => {
    const result = buildWhereClause([fc("name", "equals", "Alice")], "and", 3);
    expect(result.sql).toBe('WHERE "name" = $4');
    expect(result.params).toEqual(["Alice"]);
  });

  it("mixed param and no-param conditions index correctly", () => {
    const result = buildWhereClause([
      fc("email", "is_not_empty"),
      fc("name", "contains", "test"),
      fc("age", "greater_than", 18),
    ]);
    // is_not_empty uses no params, so next starts at $1
    expect(result.sql).toBe(
      `WHERE ("email" IS NOT NULL AND "email"::text != '') AND "name" ILIKE '%' || $1 || '%' AND "age" > $2`,
    );
    expect(result.params).toEqual(["test", 18]);
  });

  it("validates column names against allowlist", () => {
    const allowed = ["name", "age"];
    expect(() =>
      buildWhereClause([fc("email", "equals", "x")], "and", 0, allowed),
    ).toThrow("Column not found");

    // Valid column works
    const result = buildWhereClause(
      [fc("name", "equals", "x")],
      "and",
      0,
      allowed,
    );
    expect(result.sql).toBe('WHERE "name" = $1');
  });
});

// ─── SQL Injection Prevention ───────────────────────────────────────────────

describe("SQL injection prevention", () => {
  it("rejects SQL injection in column name", () => {
    expect(() =>
      buildWhereClause([fc("name; DROP TABLE users--", "equals", "x")]),
    ).toThrow("Invalid column name");
  });

  it("rejects SQL injection via quoted identifier", () => {
    expect(() => buildWhereClause([fc('name"--', "equals", "x")])).toThrow(
      "Invalid column name",
    );
  });

  it("parameterizes values — never interpolated", () => {
    const malicious = "'; DROP TABLE users;--";
    const result = buildWhereClause([fc("name", "equals", malicious)]);
    // Value is in params, not in SQL string
    expect(result.sql).toBe('WHERE "name" = $1');
    expect(result.params).toEqual([malicious]);
    expect(result.sql).not.toContain(malicious);
  });

  it("rejects table name injection in buildQuery", () => {
    expect(() => buildQuery({ table: "users; DROP TABLE x" })).toThrow(
      "Invalid column name",
    );
  });
});

// ─── buildOrderByClause ─────────────────────────────────────────────────────

describe("buildOrderByClause", () => {
  it("returns empty for no sorting", () => {
    expect(buildOrderByClause([])).toBe("");
  });

  it("single column ASC", () => {
    const sorting: SortConfig[] = [{ column: "name", direction: "asc" }];
    expect(buildOrderByClause(sorting)).toBe('ORDER BY "name" ASC');
  });

  it("single column DESC", () => {
    const sorting: SortConfig[] = [{ column: "age", direction: "desc" }];
    expect(buildOrderByClause(sorting)).toBe('ORDER BY "age" DESC');
  });

  it("multi-column sort", () => {
    const sorting: SortConfig[] = [
      { column: "last_name", direction: "asc" },
      { column: "first_name", direction: "asc" },
      { column: "age", direction: "desc" },
    ];
    expect(buildOrderByClause(sorting)).toBe(
      'ORDER BY "last_name" ASC, "first_name" ASC, "age" DESC',
    );
  });

  it("validates column names", () => {
    const sorting: SortConfig[] = [{ column: "bad col", direction: "asc" }];
    expect(() => buildOrderByClause(sorting)).toThrow("Invalid column name");
  });

  it("validates against allowlist", () => {
    const sorting: SortConfig[] = [{ column: "email", direction: "asc" }];
    expect(() => buildOrderByClause(sorting, ["name", "age"])).toThrow(
      "Column not found",
    );
  });
});

// ─── buildGroupByClause ─────────────────────────────────────────────────────

describe("buildGroupByClause", () => {
  it("returns SELECT * with no GROUP BY for empty grouping", () => {
    const result = buildGroupByClause([]);
    expect(result.selectColumns).toBe("*");
    expect(result.groupBy).toBe("");
  });

  it("single group column with default COUNT(*)", () => {
    const grouping: GroupConfig[] = [{ column: "department" }];
    const result = buildGroupByClause(grouping);
    expect(result.groupBy).toBe('GROUP BY "department"');
    expect(result.selectColumns).toContain('"department"');
    expect(result.selectColumns).toContain('COUNT(*) AS "_count"');
  });

  it("group with aggregations", () => {
    const grouping: GroupConfig[] = [
      {
        column: "department",
        aggregations: [
          { column: "salary", function: "avg", alias: "avg_salary" },
          { column: "salary", function: "sum" },
        ],
      },
    ];
    const result = buildGroupByClause(grouping);
    expect(result.groupBy).toBe('GROUP BY "department"');
    expect(result.selectColumns).toContain('AVG("salary") AS "avg_salary"');
    expect(result.selectColumns).toContain('SUM("salary") AS "sum_salary"');
    expect(result.selectColumns).toContain('COUNT(*) AS "_count"');
  });

  it("rejects invalid aggregate functions", () => {
    const grouping: GroupConfig[] = [
      {
        column: "department",
        aggregations: [{ column: "salary", function: "EVIL" as any }],
      },
    ];
    expect(() => buildGroupByClause(grouping)).toThrow(
      "Invalid aggregate function",
    );
  });

  it("validates column names", () => {
    const grouping: GroupConfig[] = [{ column: "bad col" }];
    expect(() => buildGroupByClause(grouping)).toThrow("Invalid column name");
  });
});

// ─── buildPaginationClause ──────────────────────────────────────────────────

describe("buildPaginationClause", () => {
  it("page 0", () => {
    expect(buildPaginationClause(0, 25)).toBe("LIMIT 25 OFFSET 0");
  });

  it("page 3 with pageSize 10", () => {
    expect(buildPaginationClause(3, 10)).toBe("LIMIT 10 OFFSET 30");
  });

  it("rejects negative pageSize", () => {
    expect(() => buildPaginationClause(0, -1)).toThrow(
      "pageSize must be positive",
    );
  });

  it("rejects zero pageSize", () => {
    expect(() => buildPaginationClause(0, 0)).toThrow(
      "pageSize must be positive",
    );
  });

  it("rejects negative page", () => {
    expect(() => buildPaginationClause(-1, 10)).toThrow(
      "page must be non-negative",
    );
  });
});

// ─── buildQuery — full query composition ────────────────────────────────────

describe("buildQuery", () => {
  it("simple SELECT * FROM table", () => {
    const result = buildQuery({ table: "users" });
    expect(result.sql).toBe('SELECT * FROM "users"');
    expect(result.params).toEqual([]);
  });

  it("with filters", () => {
    const result = buildQuery({
      table: "users",
      filters: [fc("name", "equals", "Alice")],
    });
    expect(result.sql).toBe('SELECT * FROM "users" WHERE "name" = $1');
    expect(result.params).toEqual(["Alice"]);
  });

  it("with sorting", () => {
    const result = buildQuery({
      table: "users",
      sorting: [{ column: "name", direction: "asc" }],
    });
    expect(result.sql).toBe('SELECT * FROM "users" ORDER BY "name" ASC');
  });

  it("with pagination", () => {
    const result = buildQuery({
      table: "users",
      page: 2,
      pageSize: 10,
    });
    expect(result.sql).toBe('SELECT * FROM "users" LIMIT 10 OFFSET 20');
  });

  it("with grouping", () => {
    const result = buildQuery({
      table: "orders",
      grouping: [{ column: "status" }],
    });
    expect(result.sql).toContain('GROUP BY "status"');
    expect(result.sql).toContain('COUNT(*) AS "_count"');
    expect(result.sql).not.toContain("SELECT *");
  });

  it("all clauses composed together", () => {
    const result = buildQuery({
      table: "users",
      filters: [fc("active", "equals", true)],
      sorting: [{ column: "name", direction: "asc" }],
      page: 0,
      pageSize: 25,
    });
    expect(result.sql).toBe(
      'SELECT * FROM "users" WHERE "active" = $1 ORDER BY "name" ASC LIMIT 25 OFFSET 0',
    );
    expect(result.params).toEqual([true]);
  });
});

// ─── buildCountQuery ────────────────────────────────────────────────────────

describe("buildCountQuery", () => {
  it("simple count", () => {
    const result = buildCountQuery({ table: "users" });
    expect(result.sql).toBe('SELECT COUNT(*) AS "total" FROM "users"');
    expect(result.params).toEqual([]);
  });

  it("count with filters", () => {
    const result = buildCountQuery({
      table: "users",
      filters: [fc("active", "equals", true)],
    });
    expect(result.sql).toBe(
      'SELECT COUNT(*) AS "total" FROM "users" WHERE "active" = $1',
    );
    expect(result.params).toEqual([true]);
  });

  it("count ignores sorting and pagination", () => {
    const result = buildCountQuery({
      table: "users",
      sorting: [{ column: "name", direction: "asc" }],
      page: 5,
      pageSize: 10,
    });
    expect(result.sql).toBe('SELECT COUNT(*) AS "total" FROM "users"');
    expect(result.sql).not.toContain("ORDER BY");
    expect(result.sql).not.toContain("LIMIT");
  });
});

// ─── buildGlobalSearchClause ────────────────────────────────────────────────

describe("buildGlobalSearchClause", () => {
  it("returns empty for empty search term", () => {
    const result = buildGlobalSearchClause("", ["name", "email"]);
    expect(result.sql).toBe("");
    expect(result.params).toEqual([]);
  });

  it("returns empty for no columns", () => {
    const result = buildGlobalSearchClause("alice", []);
    expect(result.sql).toBe("");
    expect(result.params).toEqual([]);
  });

  it("searches single column", () => {
    const result = buildGlobalSearchClause("alice", ["name"]);
    expect(result.sql).toBe("(\"name\"::text ILIKE '%' || $1 || '%')");
    expect(result.params).toEqual(["alice"]);
  });

  it("searches multiple columns with OR", () => {
    const result = buildGlobalSearchClause("alice", ["name", "email"]);
    expect(result.sql).toContain('"name"::text ILIKE');
    expect(result.sql).toContain(" OR ");
    expect(result.sql).toContain('"email"::text ILIKE');
    expect(result.params).toEqual(["alice"]);
  });

  it("uses paramOffset correctly", () => {
    const result = buildGlobalSearchClause("test", ["name"], 2);
    expect(result.sql).toContain("$3");
    expect(result.params).toEqual(["test"]);
  });

  it("validates against allowedColumns", () => {
    expect(() =>
      buildGlobalSearchClause("test", ["hacked"], 0, ["name", "email"]),
    ).toThrow("Column not found");
  });
});

// ─── buildQuery with globalSearch ───────────────────────────────────────────

describe("buildQuery with globalSearch", () => {
  it("adds global search to query", () => {
    const result = buildQuery({
      table: "users",
      globalSearch: "alice",
      allowedColumns: ["name", "email"],
    });
    expect(result.sql).toContain("WHERE");
    expect(result.sql).toContain("ILIKE");
    expect(result.params).toEqual(["alice"]);
  });

  it("combines filters and global search with AND", () => {
    const result = buildQuery({
      table: "users",
      filters: [fc("active", "equals", true)],
      globalSearch: "alice",
      allowedColumns: ["name", "email", "active"],
    });
    expect(result.sql).toContain('"active" = $1');
    expect(result.sql).toContain("AND");
    expect(result.sql).toContain("ILIKE");
    expect(result.params).toEqual([true, "alice"]);
  });

  it("count query includes global search", () => {
    const result = buildCountQuery({
      table: "users",
      globalSearch: "bob",
      allowedColumns: ["name", "email"],
    });
    expect(result.sql).toContain("COUNT(*)");
    expect(result.sql).toContain("WHERE");
    expect(result.sql).toContain("ILIKE");
    expect(result.params).toEqual(["bob"]);
  });
});

// ─── buildGroupSummaryQuery ─────────────────────────────────────────────────

describe("buildGroupSummaryQuery", () => {
  it("single group column", () => {
    const result = buildGroupSummaryQuery({
      table: "employees",
      grouping: [{ column: "department" }],
    });
    expect(result.sql).toContain('SELECT "department"');
    expect(result.sql).toContain('COUNT(*) AS "_count"');
    expect(result.sql).toContain('FROM "employees"');
    expect(result.sql).toContain('GROUP BY "department"');
    expect(result.sql).toContain('ORDER BY "department"');
    expect(result.params).toEqual([]);
  });

  it("multi-level grouping (2 columns)", () => {
    const result = buildGroupSummaryQuery({
      table: "employees",
      grouping: [{ column: "department" }, { column: "role" }],
    });
    expect(result.sql).toContain('"department"');
    expect(result.sql).toContain('"role"');
    expect(result.sql).toContain('GROUP BY "department", "role"');
    expect(result.sql).toContain('ORDER BY "department", "role"');
  });

  it("with aggregations", () => {
    const result = buildGroupSummaryQuery({
      table: "employees",
      grouping: [
        {
          column: "department",
          aggregations: [
            { column: "salary", function: "avg", alias: "avg_salary" },
          ],
        },
      ],
    });
    expect(result.sql).toContain('AVG("salary") AS "avg_salary"');
    expect(result.sql).toContain('COUNT(*) AS "_count"');
  });

  it("with filters", () => {
    const result = buildGroupSummaryQuery({
      table: "employees",
      grouping: [{ column: "department" }],
      filters: [fc("active", "equals", true)],
    });
    expect(result.sql).toContain('WHERE "active" = $1');
    expect(result.sql).toContain('GROUP BY "department"');
    expect(result.params).toEqual([true]);
  });

  it("with pagination on groups", () => {
    const result = buildGroupSummaryQuery({
      table: "employees",
      grouping: [{ column: "department" }],
      page: 1,
      pageSize: 10,
    });
    expect(result.sql).toContain("LIMIT 10 OFFSET 10");
  });

  it("with explicit sorting", () => {
    const result = buildGroupSummaryQuery({
      table: "employees",
      grouping: [{ column: "department" }],
      sorting: [{ column: "department", direction: "desc" }],
    });
    expect(result.sql).toContain('ORDER BY "department" DESC');
  });

  it("with global search", () => {
    const result = buildGroupSummaryQuery({
      table: "employees",
      grouping: [{ column: "department" }],
      globalSearch: "eng",
      allowedColumns: ["department", "name"],
    });
    expect(result.sql).toContain("ILIKE");
    expect(result.params).toEqual(["eng"]);
  });

  it("throws with no grouping", () => {
    expect(() =>
      buildGroupSummaryQuery({ table: "employees", grouping: [] }),
    ).toThrow("requires at least one group");
  });

  it("validates column names", () => {
    expect(() =>
      buildGroupSummaryQuery({
        table: "employees",
        grouping: [{ column: "bad col" }],
      }),
    ).toThrow("Invalid column name");
  });

  it("validates against allowedColumns", () => {
    expect(() =>
      buildGroupSummaryQuery({
        table: "employees",
        grouping: [{ column: "secret" }],
        allowedColumns: ["department", "name"],
      }),
    ).toThrow("Column not found");
  });
});

// ─── buildGroupCountQuery ───────────────────────────────────────────────────

describe("buildGroupCountQuery", () => {
  it("counts distinct groups", () => {
    const result = buildGroupCountQuery({
      table: "employees",
      grouping: [{ column: "department" }],
    });
    expect(result.sql).toContain('SELECT COUNT(*) AS "total"');
    expect(result.sql).toContain("FROM (SELECT 1");
    expect(result.sql).toContain('GROUP BY "department"');
    expect(result.sql).toContain(') AS "_groups"');
    expect(result.params).toEqual([]);
  });

  it("counts with filters", () => {
    const result = buildGroupCountQuery({
      table: "employees",
      grouping: [{ column: "department" }],
      filters: [fc("active", "equals", true)],
    });
    expect(result.sql).toContain('WHERE "active" = $1');
    expect(result.params).toEqual([true]);
  });

  it("multi-level grouping", () => {
    const result = buildGroupCountQuery({
      table: "employees",
      grouping: [{ column: "department" }, { column: "role" }],
    });
    expect(result.sql).toContain('GROUP BY "department", "role"');
  });

  it("throws with no grouping", () => {
    expect(() =>
      buildGroupCountQuery({ table: "employees", grouping: [] }),
    ).toThrow("requires at least one group");
  });
});

// ─── buildGroupDetailQuery ──────────────────────────────────────────────────

describe("buildGroupDetailQuery", () => {
  it("single group value", () => {
    const result = buildGroupDetailQuery({
      table: "employees",
      groupValues: [{ column: "department", value: "Engineering" }],
    });
    expect(result.sql).toBe(
      'SELECT * FROM "employees" WHERE "department" = $1',
    );
    expect(result.params).toEqual(["Engineering"]);
  });

  it("multi-level group values", () => {
    const result = buildGroupDetailQuery({
      table: "employees",
      groupValues: [
        { column: "department", value: "Engineering" },
        { column: "role", value: "Senior" },
      ],
    });
    expect(result.sql).toBe(
      'SELECT * FROM "employees" WHERE "department" = $1 AND "role" = $2',
    );
    expect(result.params).toEqual(["Engineering", "Senior"]);
  });

  it("handles NULL group value", () => {
    const result = buildGroupDetailQuery({
      table: "employees",
      groupValues: [{ column: "department", value: null }],
    });
    expect(result.sql).toBe(
      'SELECT * FROM "employees" WHERE "department" IS NULL',
    );
    expect(result.params).toEqual([]);
  });

  it("mixed NULL and non-NULL values", () => {
    const result = buildGroupDetailQuery({
      table: "employees",
      groupValues: [
        { column: "department", value: null },
        { column: "role", value: "Senior" },
      ],
    });
    expect(result.sql).toBe(
      'SELECT * FROM "employees" WHERE "department" IS NULL AND "role" = $1',
    );
    expect(result.params).toEqual(["Senior"]);
  });

  it("with filters", () => {
    const result = buildGroupDetailQuery({
      table: "employees",
      groupValues: [{ column: "department", value: "Engineering" }],
      filters: [fc("active", "equals", true)],
    });
    expect(result.sql).toContain('"active" = $1');
    expect(result.sql).toContain('"department" = $2');
    expect(result.params).toEqual([true, "Engineering"]);
  });

  it("with sorting", () => {
    const result = buildGroupDetailQuery({
      table: "employees",
      groupValues: [{ column: "department", value: "Engineering" }],
      sorting: [{ column: "name", direction: "asc" }],
    });
    expect(result.sql).toContain('ORDER BY "name" ASC');
  });

  it("with global search", () => {
    const result = buildGroupDetailQuery({
      table: "employees",
      groupValues: [{ column: "department", value: "Engineering" }],
      globalSearch: "alice",
      allowedColumns: ["department", "name"],
    });
    expect(result.sql).toContain("ILIKE");
    expect(result.params).toContain("alice");
    expect(result.params).toContain("Engineering");
  });

  it("throws with no group values", () => {
    expect(() =>
      buildGroupDetailQuery({ table: "employees", groupValues: [] }),
    ).toThrow("requires at least one group value");
  });

  it("validates column names", () => {
    expect(() =>
      buildGroupDetailQuery({
        table: "employees",
        groupValues: [{ column: "bad col", value: "x" }],
      }),
    ).toThrow("Invalid column name");
  });

  it("validates against allowedColumns", () => {
    expect(() =>
      buildGroupDetailQuery({
        table: "employees",
        groupValues: [{ column: "secret", value: "x" }],
        allowedColumns: ["department", "name"],
      }),
    ).toThrow("Column not found");
  });
});

// ─── resolveFrom ────────────────────────────────────────────────────────────

describe("resolveFrom", () => {
  it("returns quoted table name for table param", () => {
    expect(resolveFrom("users")).toBe('"users"');
  });

  it("wraps source as subquery", () => {
    expect(resolveFrom(undefined, "SELECT * FROM users")).toBe(
      "(SELECT * FROM users) AS _gridlite_sub",
    );
  });

  it("prefers source over table", () => {
    expect(resolveFrom("users", "SELECT * FROM users")).toBe(
      "(SELECT * FROM users) AS _gridlite_sub",
    );
  });

  it("throws when neither provided", () => {
    expect(() => resolveFrom()).toThrow("Either `table` or `source`");
  });
});

// ─── buildQuery with source ─────────────────────────────────────────────────

describe("buildQuery with source (subquery mode)", () => {
  it("wraps source as subquery", () => {
    const result = buildQuery({ source: "SELECT id, name FROM users" });
    expect(result.sql).toBe(
      "SELECT * FROM (SELECT id, name FROM users) AS _gridlite_sub",
    );
    expect(result.params).toEqual([]);
  });

  it("applies filters to subquery", () => {
    const result = buildQuery({
      source: "SELECT * FROM users",
      filters: [fc("name", "equals", "Alice")],
    });
    expect(result.sql).toBe(
      'SELECT * FROM (SELECT * FROM users) AS _gridlite_sub WHERE "name" = $1',
    );
    expect(result.params).toEqual(["Alice"]);
  });

  it("applies sorting to subquery", () => {
    const result = buildQuery({
      source: "SELECT * FROM users",
      sorting: [{ column: "name", direction: "desc" }],
    });
    expect(result.sql).toBe(
      'SELECT * FROM (SELECT * FROM users) AS _gridlite_sub ORDER BY "name" DESC',
    );
  });

  it("applies pagination to subquery", () => {
    const result = buildQuery({
      source: "SELECT * FROM users",
      page: 1,
      pageSize: 20,
    });
    expect(result.sql).toBe(
      "SELECT * FROM (SELECT * FROM users) AS _gridlite_sub LIMIT 20 OFFSET 20",
    );
  });

  it("applies all clauses to subquery", () => {
    const result = buildQuery({
      source:
        "SELECT e.*, d.name AS dept FROM employees e JOIN departments d ON e.dept_id = d.id",
      filters: [fc("active", "equals", true)],
      sorting: [{ column: "name", direction: "asc" }],
      page: 0,
      pageSize: 25,
    });
    expect(result.sql).toContain("AS _gridlite_sub");
    expect(result.sql).toContain('WHERE "active" = $1');
    expect(result.sql).toContain('ORDER BY "name" ASC');
    expect(result.sql).toContain("LIMIT 25 OFFSET 0");
    expect(result.params).toEqual([true]);
  });
});

describe("buildCountQuery with source", () => {
  it("counts over subquery", () => {
    const result = buildCountQuery({ source: "SELECT * FROM users" });
    expect(result.sql).toBe(
      'SELECT COUNT(*) AS "total" FROM (SELECT * FROM users) AS _gridlite_sub',
    );
  });

  it("counts with filters over subquery", () => {
    const result = buildCountQuery({
      source: "SELECT * FROM users",
      filters: [fc("active", "equals", true)],
    });
    expect(result.sql).toContain("AS _gridlite_sub");
    expect(result.sql).toContain('WHERE "active" = $1');
    expect(result.params).toEqual([true]);
  });
});

// ─── buildWhereClauseFromNodes — nested filter groups ───────────────────────

function fg(logic: "and" | "or", children: FilterNode[]): FilterGroup {
  return {
    id: `group-${Math.random().toString(36).substr(2, 6)}`,
    logic,
    children,
  };
}

describe("buildWhereClauseFromNodes", () => {
  it("single leaf — same as flat buildWhereClause", () => {
    const result = buildWhereClauseFromNodes([fc("name", "equals", "Alice")]);
    expect(result.sql).toBe('WHERE "name" = $1');
    expect(result.params).toEqual(["Alice"]);
  });

  it("flat array of leaves with AND", () => {
    const result = buildWhereClauseFromNodes(
      [fc("name", "equals", "Alice"), fc("age", "greater_than", 25)],
      "and",
    );
    expect(result.sql).toBe('WHERE "name" = $1 AND "age" > $2');
    expect(result.params).toEqual(["Alice", 25]);
  });

  it("flat array of leaves with OR", () => {
    const result = buildWhereClauseFromNodes(
      [fc("name", "equals", "Alice"), fc("name", "equals", "Bob")],
      "or",
    );
    expect(result.sql).toBe('WHERE "name" = $1 OR "name" = $2');
    expect(result.params).toEqual(["Alice", "Bob"]);
  });

  it("single group with 2 leaves", () => {
    const group = fg("or", [
      fc("status", "equals", "active"),
      fc("status", "equals", "pending"),
    ]);
    const result = buildWhereClauseFromNodes([group]);
    expect(result.sql).toBe('WHERE ("status" = $1 OR "status" = $2)');
    expect(result.params).toEqual(["active", "pending"]);
  });

  it("mixed: leaf AND group — A AND (B OR C)", () => {
    const result = buildWhereClauseFromNodes(
      [
        fc("active", "equals", true),
        fg("or", [
          fc("role", "equals", "admin"),
          fc("role", "equals", "editor"),
        ]),
      ],
      "and",
    );
    expect(result.sql).toBe(
      'WHERE "active" = $1 AND ("role" = $2 OR "role" = $3)',
    );
    expect(result.params).toEqual([true, "admin", "editor"]);
  });

  it("nested groups — A AND (B OR (C AND D))", () => {
    const result = buildWhereClauseFromNodes(
      [
        fc("active", "equals", true),
        fg("or", [
          fc("role", "equals", "admin"),
          fg("and", [
            fc("dept", "equals", "eng"),
            fc("level", "greater_than", 3),
          ]),
        ]),
      ],
      "and",
    );
    expect(result.sql).toBe(
      'WHERE "active" = $1 AND ("role" = $2 OR ("dept" = $3 AND "level" > $4))',
    );
    expect(result.params).toEqual([true, "admin", "eng", 3]);
  });

  it("empty group skipped — produces no SQL", () => {
    const result = buildWhereClauseFromNodes([fg("or", [])]);
    expect(result.sql).toBe("");
    expect(result.params).toEqual([]);
  });

  it("group with only invalid children skipped", () => {
    const result = buildWhereClauseFromNodes([
      fc("name", "equals", "Alice"),
      fg("or", [fc("", "equals", "x"), fc("age", "equals", "")]),
    ]);
    expect(result.sql).toBe('WHERE "name" = $1');
    expect(result.params).toEqual(["Alice"]);
  });

  it("group with single child — parentheses preserved", () => {
    const result = buildWhereClauseFromNodes([
      fc("name", "equals", "Alice"),
      fg("or", [fc("role", "equals", "admin")]),
    ]);
    expect(result.sql).toBe('WHERE "name" = $1 AND ("role" = $2)');
    expect(result.params).toEqual(["Alice", "admin"]);
  });

  it("parameter indexing with paramOffset", () => {
    const result = buildWhereClauseFromNodes(
      [
        fc("name", "equals", "Alice"),
        fg("or", [fc("a", "equals", "x"), fc("b", "equals", "y")]),
      ],
      "and",
      5,
    );
    expect(result.sql).toBe('WHERE "name" = $6 AND ("a" = $7 OR "b" = $8)');
    expect(result.params).toEqual(["Alice", "x", "y"]);
  });

  it("backwards compat: buildWhereClause with flat conditions unchanged", () => {
    const result = buildWhereClause(
      [fc("name", "equals", "Alice"), fc("age", "greater_than", 25)],
      "and",
    );
    expect(result.sql).toBe('WHERE "name" = $1 AND "age" > $2');
    expect(result.params).toEqual(["Alice", 25]);
  });

  it("column validation inside groups", () => {
    const allowed = ["name", "age"];
    expect(() =>
      buildWhereClauseFromNodes(
        [fg("or", [fc("secret", "equals", "x")])],
        "and",
        0,
        allowed,
      ),
    ).toThrow("Column not found");
  });

  it("SQL injection prevention in nested leaves", () => {
    expect(() =>
      buildWhereClauseFromNodes([
        fg("or", [fc("name; DROP TABLE users--", "equals", "x")]),
      ]),
    ).toThrow("Invalid column name");
  });

  it("is_empty inside group — no params consumed", () => {
    const result = buildWhereClauseFromNodes(
      [
        fc("active", "equals", true),
        fg("or", [fc("email", "is_empty"), fc("name", "contains", "test")]),
      ],
      "and",
    );
    expect(result.sql).toBe(
      `WHERE "active" = $1 AND (("email" IS NULL OR "email"::text = '') OR "name" ILIKE '%' || $2 || '%')`,
    );
    expect(result.params).toEqual([true, "test"]);
  });
});

// ─── Column-to-Column Comparison ────────────────────────────────────────────

describe("buildWhereClause — column comparison", () => {
  const allowed = ["a", "b", "c", "created_at", "updated_at"];

  it("column equals — no params consumed", () => {
    const result = buildWhereClause(
      [fcc("a", "equals", "b")],
      "and",
      0,
      allowed,
    );
    expect(result.sql).toBe('WHERE "a" = "b"');
    expect(result.params).toEqual([]);
  });

  it("column greater_than", () => {
    const result = buildWhereClause(
      [fcc("a", "greater_than", "b")],
      "and",
      0,
      allowed,
    );
    expect(result.sql).toBe('WHERE "a" > "b"');
    expect(result.params).toEqual([]);
  });

  it("column less_than", () => {
    const result = buildWhereClause(
      [fcc("a", "less_than", "b")],
      "and",
      0,
      allowed,
    );
    expect(result.sql).toBe('WHERE "a" < "b"');
    expect(result.params).toEqual([]);
  });

  it("column with interval offset", () => {
    const result = buildWhereClause(
      [fcc("updated_at", "is_after", "created_at", "6 months")],
      "and",
      0,
      allowed,
    );
    expect(result.sql).toBe(
      `WHERE "updated_at" > "created_at" + INTERVAL '6 months'`,
    );
    expect(result.params).toEqual([]);
  });

  it("column comparison mixed with literal — params numbered correctly", () => {
    const conditions: FilterCondition[] = [
      fc("a", "equals", "hello"),
      fcc("b", "greater_than", "c"),
    ];
    const result = buildWhereClause(conditions, "and", 0, allowed);
    expect(result.sql).toBe('WHERE "a" = $1 AND "b" > "c"');
    expect(result.params).toEqual(["hello"]);
  });

  it("validates valueColumn against allowedColumns", () => {
    expect(() =>
      buildWhereClause([fcc("a", "equals", "nonexistent")], "and", 0, allowed),
    ).toThrow("Column not found");
  });

  it("rejects SQL injection in valueColumn", () => {
    expect(() =>
      buildWhereClause(
        [fcc("a", "equals", "b; DROP TABLE users")],
        "and",
        0,
        allowed,
      ),
    ).toThrow("Invalid column name");
  });

  it("rejects invalid interval string", () => {
    expect(() =>
      buildWhereClause(
        [fcc("a", "is_after", "b", "6 months; DROP TABLE")],
        "and",
        0,
        allowed,
      ),
    ).toThrow("Invalid interval");
  });

  it("accepts various valid intervals", () => {
    for (const interval of [
      "1 day",
      "12 months",
      "2 years",
      "30 seconds",
      "1 hour",
    ]) {
      const result = buildWhereClause(
        [fcc("a", "greater_than", "b", interval)],
        "and",
        0,
        allowed,
      );
      expect(result.sql).toBe(`WHERE "a" > "b" + INTERVAL '${interval}'`);
      expect(result.params).toEqual([]);
    }
  });

  it("intervalOffset without valueColumn is ignored — falls back to literal", () => {
    const condition: FilterCondition = {
      id: "test-interval-no-col",
      field: "a",
      operator: "greater_than",
      value: 42,
      intervalOffset: "6 months",
    };
    const result = buildWhereClause([condition], "and", 0, allowed);
    // No valueColumn → literal comparison, intervalOffset ignored
    expect(result.sql).toBe('WHERE "a" > $1');
    expect(result.params).toEqual([42]);
  });

  it("unsupported operator for column comparison throws", () => {
    expect(() =>
      buildWhereClause([fcc("a", "contains", "b")], "and", 0, allowed),
    ).toThrow("does not support column-to-column comparison");
  });
});

// ─── PGLite Integration Tests — JSONB Filtering ────────────────────────────

import { PGlite } from "@electric-sql/pglite";

describe("JSONB filtering (PGLite integration)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        tags JSONB
      )
    `);
    await db.exec(`
      INSERT INTO items (name, tags) VALUES
        ('Item A', '{"JavaScript": true, "TypeScript": true}'),
        ('Item B', '{"Python": true, "SQL": true}'),
        ('Item C', '{"JavaScript": true, "Python": true, "Go": true}'),
        ('Item D', '{"Rust": true}'),
        ('Item E', NULL)
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("jsonb_has_key filters rows that contain the key", async () => {
    const where = buildWhereClause(
      [fc("tags", "jsonb_has_key", "JavaScript")],
      "and",
      0,
      ["tags"],
    );
    const result = await db.query<{ name: string }>(
      `SELECT name FROM items ${where.sql} ORDER BY name`,
      where.params,
    );
    expect(result.rows.map((r) => r.name)).toEqual(["Item A", "Item C"]);
  });

  it("jsonb_not_has_key excludes rows that contain the key", async () => {
    const where = buildWhereClause(
      [fc("tags", "jsonb_not_has_key", "JavaScript")],
      "and",
      0,
      ["tags"],
    );
    const result = await db.query<{ name: string }>(
      `SELECT name FROM items ${where.sql} ORDER BY name`,
      where.params,
    );
    // NULL tags rows are excluded by NOT (col ? key) — NULL ? key = NULL which is falsy
    expect(result.rows.map((r) => r.name)).toEqual(["Item B", "Item D"]);
  });

  it("jsonb_has_key combined with text filter", async () => {
    const conditions: FilterCondition[] = [
      fc("tags", "jsonb_has_key", "Python"),
      fc("name", "contains", "C"),
    ];
    const where = buildWhereClause(conditions, "and", 0, ["tags", "name"]);
    const result = await db.query<{ name: string }>(
      `SELECT name FROM items ${where.sql} ORDER BY name`,
      where.params,
    );
    expect(result.rows.map((r) => r.name)).toEqual(["Item C"]);
  });

  it("jsonb_has_key with non-existent key returns empty", async () => {
    const where = buildWhereClause(
      [fc("tags", "jsonb_has_key", "NonExistentKey")],
      "and",
      0,
      ["tags"],
    );
    const result = await db.query<{ name: string }>(
      `SELECT name FROM items ${where.sql}`,
      where.params,
    );
    expect(result.rows).toEqual([]);
  });

  it("jsonb_object_keys extracts individual keys for suggestions", async () => {
    const result = await db.query<{ val: string }>(
      `SELECT DISTINCT jsonb_object_keys("tags") AS val FROM items WHERE "tags" IS NOT NULL ORDER BY val`,
    );
    expect(result.rows.map((r) => r.val)).toEqual([
      "Go",
      "JavaScript",
      "Python",
      "Rust",
      "SQL",
      "TypeScript",
    ]);
  });

  it("is_empty works on JSONB column (no invalid json error)", async () => {
    const where = buildWhereClause([fc("tags", "is_empty")], "and", 0, [
      "tags",
    ]);
    const result = await db.query<{ name: string }>(
      `SELECT name FROM items ${where.sql} ORDER BY name`,
      where.params,
    );
    // Only Item E has NULL tags
    expect(result.rows.map((r) => r.name)).toEqual(["Item E"]);
  });

  it("is_not_empty works on JSONB column (no invalid json error)", async () => {
    const where = buildWhereClause([fc("tags", "is_not_empty")], "and", 0, [
      "tags",
    ]);
    const result = await db.query<{ name: string }>(
      `SELECT name FROM items ${where.sql} ORDER BY name`,
      where.params,
    );
    expect(result.rows.map((r) => r.name)).toEqual([
      "Item A",
      "Item B",
      "Item C",
      "Item D",
    ]);
  });

  it("column comparison works in PGLite", async () => {
    await db.exec(`
      CREATE TABLE dates_test (
        id SERIAL PRIMARY KEY,
        created_at DATE NOT NULL,
        updated_at DATE NOT NULL
      )
    `);
    await db.exec(`
      INSERT INTO dates_test (created_at, updated_at) VALUES
        ('2024-01-01', '2024-03-01'),
        ('2024-01-01', '2024-12-01'),
        ('2024-06-01', '2024-07-01')
    `);

    const where = buildWhereClause(
      [fcc("updated_at", "is_after", "created_at", "6 months")],
      "and",
      0,
      ["created_at", "updated_at"],
    );
    const result = await db.query<{ id: number }>(
      `SELECT id FROM dates_test ${where.sql} ORDER BY id`,
      where.params,
    );
    // Only row 2: updated_at (2024-12-01) > created_at (2024-01-01) + 6 months (2024-07-01)
    expect(result.rows.map((r) => r.id)).toEqual([2]);
  });
});
