import { describe, it, expect } from "vitest";
import {
  quoteIdentifier,
  resolveFrom,
  buildWhereClause,
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
import type { FilterCondition, SortConfig, GroupConfig } from "../types.js";

// ─── Helper ─────────────────────────────────────────────────────────────────

function fc(
  field: string,
  operator: FilterCondition["operator"],
  value: unknown = "",
): FilterCondition {
  return { id: `test-${field}-${operator}`, field, operator, value };
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
    expect(result.sql).toBe(`WHERE ("name" IS NULL OR "name" = '')`);
    expect(result.params).toEqual([]);
  });

  it("is_not_empty (no params)", () => {
    const result = buildWhereClause([fc("name", "is_not_empty")]);
    expect(result.sql).toBe(`WHERE ("name" IS NOT NULL AND "name" != '')`);
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
    expect(result.sql).toBe(`WHERE ("name" IS NULL OR "name" = '')`);
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
      `WHERE ("email" IS NOT NULL AND "email" != '') AND "name" ILIKE '%' || $1 || '%' AND "age" > $2`,
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
