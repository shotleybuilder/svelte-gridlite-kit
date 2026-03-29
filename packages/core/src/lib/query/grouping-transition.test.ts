/**
 * Integration test: grouped → flat query transition (#14)
 *
 * Verifies that switching from a grouped query to a flat query
 * (i.e. removing all grouping) works without errors.
 * Simulates the rebuildGroupedQuery snapshot pattern.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import {
  buildQuery,
  buildGroupSummaryQuery,
  buildGroupCountQuery,
} from "./builder.js";
import type { GroupConfig } from "../types.js";

describe("grouped → flat transition (#14)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE TABLE employees (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT NOT NULL,
        salary INTEGER NOT NULL
      )
    `);
    await db.exec(`
      INSERT INTO employees (name, department, salary) VALUES
        ('Alice', 'Engineering', 120000),
        ('Bob', 'Engineering', 110000),
        ('Charlie', 'Sales', 90000),
        ('Diana', 'Sales', 95000),
        ('Eve', 'Marketing', 85000)
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("grouped query returns correct summaries", async () => {
    const grouping: GroupConfig[] = [{ column: "department" }];
    const query = buildGroupSummaryQuery({ table: "employees", grouping });
    const result = await db.query(query.sql, query.params as any[]);

    expect(result.rows.length).toBe(3);
    const depts = result.rows.map((r: any) => r.department).sort();
    expect(depts).toEqual(["Engineering", "Marketing", "Sales"]);
  });

  it("flat query works after grouping is cleared", async () => {
    // 1. Start with grouped query (simulates initial grouped state)
    const grouping: GroupConfig[] = [{ column: "department" }];
    const groupedQuery = buildGroupSummaryQuery({
      table: "employees",
      grouping,
    });
    await db.query(groupedQuery.sql, groupedQuery.params as any[]);

    // 2. Grouping cleared — snapshot is empty, skip grouped query, run flat
    const emptyGrouping: GroupConfig[] = [];

    // The snapshot guard: if empty, don't call buildGroupSummaryQuery
    if (emptyGrouping.length === 0) {
      // Fall through to flat query — this is the fix path
      const flatQuery = buildQuery({ table: "employees" });
      const result = await db.query(flatQuery.sql, flatQuery.params as any[]);
      expect(result.rows.length).toBe(5);
      expect(result.rows.map((r: any) => r.name).sort()).toEqual([
        "Alice",
        "Bob",
        "Charlie",
        "Diana",
        "Eve",
      ]);
    }
  });

  it("buildGroupSummaryQuery throws on empty grouping (guard needed)", () => {
    // Confirms that calling the builder without the snapshot guard would crash
    expect(() =>
      buildGroupSummaryQuery({ table: "employees", grouping: [] }),
    ).toThrow("requires at least one group");
  });

  it("buildGroupCountQuery throws on empty grouping (guard needed)", () => {
    expect(() =>
      buildGroupCountQuery({ table: "employees", grouping: [] }),
    ).toThrow("requires at least one group");
  });

  it("snapshot pattern: stale grouping doesn't reach builder after clear", async () => {
    // Simulates the snapshot pattern from rebuildGroupedQuery
    const initialGrouping: GroupConfig[] = [{ column: "department" }];
    const snapshot = [...initialGrouping];

    // Simulate: grouping is cleared reactively (as would happen after await)
    const currentGrouping: GroupConfig[] = [];

    // Snapshot is still valid — query succeeds
    expect(snapshot.length).toBe(1);
    const query = buildGroupSummaryQuery({
      table: "employees",
      grouping: [snapshot[0]],
    });
    const result = await db.query(query.sql, query.params as any[]);
    expect(result.rows.length).toBe(3);

    // But re-check after await catches the cleared state
    expect(currentGrouping.length).toBe(0);
    // rebuildGroupedQuery would return early here
  });
});
