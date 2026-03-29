/**
 * Integration tests for PGLiteAdapter
 *
 * Tests the adapter against a real in-memory PGLite instance to verify
 * all QueryAdapter interface methods work correctly.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { PGLiteAdapter, createPGLiteAdapter } from "./adapter.js";
import type { PGliteWithLive } from "./live.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createTestDb(): Promise<PGliteWithLive> {
  const db = await PGlite.create({ extensions: { live } });
  return db as unknown as PGliteWithLive;
}

async function seedEmployees(db: PGliteWithLive): Promise<void> {
  await db.query(`
    CREATE TABLE employees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      salary NUMERIC NOT NULL,
      active BOOLEAN DEFAULT true,
      hired_date DATE
    )
  `);
  await db.query(`
    INSERT INTO employees (name, department, salary, active, hired_date) VALUES
      ('Alice', 'Engineering', 120000, true, '2020-01-15'),
      ('Bob', 'Engineering', 110000, true, '2021-03-01'),
      ('Charlie', 'Sales', 90000, true, '2019-06-20'),
      ('Diana', 'Sales', 95000, false, '2018-11-10'),
      ('Eve', 'Marketing', 85000, true, '2022-07-01')
  `);
}

// ─── Constructor ────────────────────────────────────────────────────────────

describe("PGLiteAdapter constructor", () => {
  it("throws if no db provided", () => {
    expect(() => new PGLiteAdapter({} as any)).toThrow("requires a db");
  });

  it("throws if neither table nor query provided", async () => {
    const db = await createTestDb();
    expect(() => new PGLiteAdapter({ db })).toThrow(
      "requires either table or query",
    );
  });

  it("throws if both table and query provided", async () => {
    const db = await createTestDb();
    expect(
      () =>
        new PGLiteAdapter({
          db,
          table: "employees",
          query: "SELECT * FROM employees",
        }),
    ).toThrow("mutually exclusive");
  });

  it("succeeds with table", async () => {
    const db = await createTestDb();
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    expect(adapter).toBeInstanceOf(PGLiteAdapter);
  });

  it("succeeds with query", async () => {
    const db = await createTestDb();
    const adapter = new PGLiteAdapter({
      db,
      query: "SELECT * FROM employees",
    });
    expect(adapter).toBeInstanceOf(PGLiteAdapter);
  });
});

// ─── Factory ────────────────────────────────────────────────────────────────

describe("createPGLiteAdapter", () => {
  it("returns a QueryAdapter", async () => {
    const db = await createTestDb();
    const adapter = createPGLiteAdapter({ db, table: "employees" });
    expect(adapter).toBeDefined();
    expect(typeof adapter.init).toBe("function");
    expect(typeof adapter.execute).toBe("function");
    expect(typeof adapter.createLiveQuery).toBe("function");
  });
});

// ─── Lifecycle & Schema ─────────────────────────────────────────────────────

describe("init and introspect", () => {
  let db: PGliteWithLive;

  beforeEach(async () => {
    db = await createTestDb();
    await seedEmployees(db);
  });

  it("introspects table columns after init", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    const columns = await adapter.introspect();
    expect(columns.length).toBe(6);
    const names = columns.map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("name");
    expect(names).toContain("department");
    expect(names).toContain("salary");
    expect(names).toContain("active");
    expect(names).toContain("hired_date");
  });

  it("getAllowedColumns returns column names", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    const allowed = adapter.getAllowedColumns();
    expect(allowed).toContain("name");
    expect(allowed).toContain("salary");
    expect(allowed.length).toBe(6);
  });

  it("returns empty columns before init", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    const columns = await adapter.introspect();
    expect(columns).toEqual([]);
  });

  it("runs migrations during init", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    // Verify migration tables exist
    const result = await db.query(
      `SELECT tablename FROM pg_tables WHERE tablename LIKE '_gridlite_%'`,
    );
    const tables = result.rows.map((r: any) => r.tablename);
    expect(tables).toContain("_gridlite_views");
    expect(tables).toContain("_gridlite_column_state");
  });
});

// ─── Execute ────────────────────────────────────────────────────────────────

describe("execute", () => {
  let db: PGliteWithLive;

  beforeEach(async () => {
    db = await createTestDb();
    await seedEmployees(db);
  });

  it("runs a simple query", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    const result = await adapter.execute("SELECT * FROM employees");
    expect(result.rows.length).toBe(5);
  });

  it("runs a parameterized query", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    const result = await adapter.execute(
      "SELECT * FROM employees WHERE department = $1",
      ["Engineering"],
    );
    expect(result.rows.length).toBe(2);
  });

  it("runs aggregation queries", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    const result = await adapter.execute<{ count: string }>(
      "SELECT COUNT(*) AS count FROM employees",
    );
    expect(Number(result.rows[0].count)).toBe(5);
  });
});

// ─── State Persistence ──────────────────────────────────────────────────────

describe("column state persistence", () => {
  let db: PGliteWithLive;

  beforeEach(async () => {
    db = await createTestDb();
    await seedEmployees(db);
  });

  it("saves and loads column state", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    await adapter.saveColumnState("test-grid", [
      { name: "name", visible: true, width: 200, position: 0, label: "Name" },
      {
        name: "salary",
        visible: true,
        width: 120,
        position: 1,
        label: "Salary",
      },
      {
        name: "department",
        visible: false,
        width: null,
        position: 2,
        label: null,
      },
    ]);

    const loaded = await adapter.loadColumnState("test-grid");
    expect(loaded.length).toBe(3);

    const nameCol = loaded.find((c) => c.name === "name");
    expect(nameCol).toBeDefined();
    expect(nameCol!.visible).toBe(true);
    expect(nameCol!.width).toBe(200);
    expect(nameCol!.label).toBe("Name");

    const deptCol = loaded.find((c) => c.name === "department");
    expect(deptCol).toBeDefined();
    expect(deptCol!.visible).toBe(false);
  });

  it("returns empty array for unknown grid", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    const loaded = await adapter.loadColumnState("nonexistent-grid");
    expect(loaded).toEqual([]);
  });

  it("supports view-scoped state", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    await adapter.saveColumnState(
      "test-grid",
      [
        {
          name: "name",
          visible: true,
          width: 100,
          position: 0,
          label: null,
        },
      ],
      "view-a",
    );
    await adapter.saveColumnState(
      "test-grid",
      [
        {
          name: "name",
          visible: false,
          width: 300,
          position: 0,
          label: null,
        },
      ],
      "view-b",
    );

    const a = await adapter.loadColumnState("test-grid", "view-a");
    const b = await adapter.loadColumnState("test-grid", "view-b");
    expect(a[0].width).toBe(100);
    expect(a[0].visible).toBe(true);
    expect(b[0].width).toBe(300);
    expect(b[0].visible).toBe(false);
  });
});

// ─── View Persistence ───────────────────────────────────────────────────────

describe("view persistence", () => {
  let db: PGliteWithLive;

  beforeEach(async () => {
    db = await createTestDb();
    await seedEmployees(db);
  });

  it("saves and loads a view", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    await adapter.saveView("test-grid", {
      id: "view-1",
      name: "Active Engineers",
      filters: [
        {
          id: "f1",
          field: "department",
          operator: "equals",
          value: "Engineering",
        },
      ],
      filterLogic: "and",
      sorting: [{ column: "name", direction: "asc" }],
      grouping: [],
      columnVisibility: { name: true, salary: true },
      columnOrder: ["name", "salary"],
    });

    const loaded = await adapter.loadView("view-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe("Active Engineers");
    expect(loaded!.filters).toHaveLength(1);
    expect(loaded!.sorting).toHaveLength(1);
    expect(loaded!.columnOrder).toEqual(["name", "salary"]);
  });

  it("loads all views for a grid sorted by name", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    await adapter.saveView("test-grid", { id: "v-b", name: "Beta" });
    await adapter.saveView("test-grid", { id: "v-a", name: "Alpha" });

    const views = await adapter.loadViews("test-grid");
    expect(views).toHaveLength(2);
    expect(views[0].name).toBe("Alpha");
    expect(views[1].name).toBe("Beta");
  });

  it("deletes a view", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    await adapter.saveView("test-grid", { id: "v1", name: "Delete Me" });
    await adapter.deleteView("v1");

    const loaded = await adapter.loadView("v1");
    expect(loaded).toBeNull();
  });

  it("sets and loads default view", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    await adapter.saveView("test-grid", { id: "v1", name: "View 1" });
    await adapter.saveView("test-grid", { id: "v2", name: "View 2" });
    await adapter.setDefaultView("test-grid", "v2");

    const def = await adapter.loadDefaultView("test-grid");
    expect(def).not.toBeNull();
    expect(def!.id).toBe("v2");
  });

  it("returns null/empty for nonexistent data", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    expect(await adapter.loadView("nope")).toBeNull();
    expect(await adapter.loadViews("nope")).toEqual([]);
    expect(await adapter.loadDefaultView("nope")).toBeNull();
  });
});

// ─── Filter Suggestions ─────────────────────────────────────────────────────

describe("getDistinctValues", () => {
  let db: PGliteWithLive;

  beforeEach(async () => {
    db = await createTestDb();
    await seedEmployees(db);
  });

  it("returns distinct values for a text column", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    const values = await adapter.getDistinctValues("department");
    expect(values).toContain("Engineering");
    expect(values).toContain("Sales");
    expect(values).toContain("Marketing");
    expect(values.length).toBe(3);
  });

  it("returns distinct values sorted", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    const values = await adapter.getDistinctValues("department");
    expect(values).toEqual([...values].sort());
  });

  it("throws for invalid column", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    await expect(adapter.getDistinctValues("nonexistent")).rejects.toThrow(
      "Column not found",
    );
  });
});

describe("getNumericRange", () => {
  let db: PGliteWithLive;

  beforeEach(async () => {
    db = await createTestDb();
    await seedEmployees(db);
  });

  it("returns min/max for numeric column", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    const range = await adapter.getNumericRange("salary");
    expect(range).not.toBeNull();
    expect(range!.min).toBe(85000);
    expect(range!.max).toBe(120000);
  });

  it("returns null for non-numeric column", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    const range = await adapter.getNumericRange("name");
    expect(range).toBeNull();
  });
});

// ─── Live Query ─────────────────────────────────────────────────────────────

describe("createLiveQuery", () => {
  let db: PGliteWithLive;

  beforeEach(async () => {
    db = await createTestDb();
    await seedEmployees(db);
  });

  it("returns a LiveQueryHandle with subscribe/destroy", async () => {
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    await adapter.init();

    const handle = adapter.createLiveQuery(
      "SELECT * FROM employees ORDER BY id",
    );
    expect(typeof handle.subscribe).toBe("function");
    expect(typeof handle.destroy).toBe("function");
    expect(typeof handle.refresh).toBe("function");
    expect(typeof handle.update).toBe("function");

    // Subscribe and verify we get data
    let receivedRows: any[] = [];
    const unsub = handle.subscribe((state) => {
      receivedRows = state.rows;
    });

    // Wait for live query to deliver initial results
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(receivedRows.length).toBe(5);

    unsub();
    await handle.destroy();
  });
});

// ─── Query Source ───────────────────────────────────────────────────────────

describe("getTable / getSource", () => {
  it("returns table when constructed with table", async () => {
    const db = await createTestDb();
    const adapter = new PGLiteAdapter({ db, table: "employees" });
    expect(adapter.getTable()).toBe("employees");
    expect(adapter.getSource()).toBeUndefined();
  });

  it("returns source when constructed with query", async () => {
    const db = await createTestDb();
    const adapter = new PGLiteAdapter({
      db,
      query: "SELECT * FROM employees",
    });
    expect(adapter.getTable()).toBeUndefined();
    expect(adapter.getSource()).toBe("SELECT * FROM employees");
  });
});

// ─── setColumnsFromResult ───────────────────────────────────────────────────

describe("setColumnsFromResult", () => {
  it("updates columns and allowedColumns", async () => {
    const db = await createTestDb();
    const adapter = new PGLiteAdapter({
      db,
      query: "SELECT 1 AS a, 2 AS b",
    });

    expect(adapter.getAllowedColumns()).toEqual([]);

    adapter.setColumnsFromResult([
      { name: "a", dataType: "number", pgType: "integer" },
      { name: "b", dataType: "number", pgType: "integer" },
    ]);

    expect(adapter.getAllowedColumns()).toEqual(["a", "b"]);
    const cols = await adapter.introspect();
    expect(cols.length).toBe(2);
  });
});
