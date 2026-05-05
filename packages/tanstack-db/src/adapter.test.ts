import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCollection, localOnlyCollectionOptions } from "@tanstack/db";
import type { Collection } from "@tanstack/db";
import { z } from "zod";
import { TanStackDBAdapter, createTanStackDBAdapter } from "./adapter.js";
import type { TanStackDBAdapterOptions } from "./adapter.js";
import type {
  ColumnMetadata,
  ViewPreset,
} from "@shotleybuilder/svelte-gridlite-kit/types";
import { waitForReady } from "./live.js";

// ─── Test helpers ─────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  id: z.number(),
  name: z.string(),
  department: z.string(),
  salary: z.number(),
  active: z.boolean(),
  hired_date: z.string(),
});

const SEED_DATA = [
  {
    id: 1,
    name: "Alice",
    department: "Engineering",
    salary: 120000,
    active: true,
    hired_date: "2020-01-15",
  },
  {
    id: 2,
    name: "Bob",
    department: "Engineering",
    salary: 110000,
    active: true,
    hired_date: "2021-03-01",
  },
  {
    id: 3,
    name: "Charlie",
    department: "Sales",
    salary: 90000,
    active: true,
    hired_date: "2019-06-20",
  },
  {
    id: 4,
    name: "Diana",
    department: "Sales",
    salary: 95000,
    active: false,
    hired_date: "2018-11-10",
  },
  {
    id: 5,
    name: "Eve",
    department: "Marketing",
    salary: 85000,
    active: true,
    hired_date: "2022-07-01",
  },
];

const EXPLICIT_COLUMNS: ColumnMetadata[] = [
  {
    name: "id",
    dataType: "number",
    postgresType: "unknown",
    nullable: false,
    hasDefault: false,
  },
  {
    name: "name",
    dataType: "text",
    postgresType: "unknown",
    nullable: false,
    hasDefault: false,
  },
  {
    name: "department",
    dataType: "text",
    postgresType: "unknown",
    nullable: false,
    hasDefault: false,
  },
  {
    name: "salary",
    dataType: "number",
    postgresType: "unknown",
    nullable: false,
    hasDefault: false,
  },
  {
    name: "active",
    dataType: "boolean",
    postgresType: "unknown",
    nullable: false,
    hasDefault: false,
  },
  {
    name: "hired_date",
    dataType: "text",
    postgresType: "unknown",
    nullable: false,
    hasDefault: false,
  },
];

function createTestCollection(): Collection<any, any, any, any, any> {
  return createCollection(
    localOnlyCollectionOptions({
      id: `test-${Date.now()}-${Math.random()}`,
      getKey: (item: { id: number }) => item.id,
      initialData: SEED_DATA,
    }),
  );
}

async function createTestAdapter(
  overrides?: Partial<TanStackDBAdapterOptions>,
) {
  const collection = createTestCollection();
  await waitForReady(collection);
  const adapter = new TanStackDBAdapter({
    collection,
    columns: EXPLICIT_COLUMNS,
    ...overrides,
  });
  await adapter.init();
  return { adapter, collection };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TanStackDBAdapter constructor", () => {
  it("throws if no collection provided", () => {
    expect(
      () =>
        new TanStackDBAdapter({
          collection: null as any,
          columns: EXPLICIT_COLUMNS,
        }),
    ).toThrow("requires a collection");
  });

  it("throws if neither columns nor schema provided", () => {
    const coll = createTestCollection();
    expect(() => new TanStackDBAdapter({ collection: coll } as any)).toThrow(
      "requires either columns or schema",
    );
  });

  it("succeeds with explicit columns", () => {
    const coll = createTestCollection();
    expect(
      () =>
        new TanStackDBAdapter({ collection: coll, columns: EXPLICIT_COLUMNS }),
    ).not.toThrow();
  });

  it("succeeds with schema", () => {
    const coll = createTestCollection();
    expect(
      () => new TanStackDBAdapter({ collection: coll, schema: employeeSchema }),
    ).not.toThrow();
  });
});

describe("createTanStackDBAdapter factory", () => {
  it("returns a QueryAdapter", async () => {
    const collection = createTestCollection();
    await waitForReady(collection);
    const adapter = createTanStackDBAdapter({
      collection,
      columns: EXPLICIT_COLUMNS,
    });
    expect(adapter).toBeDefined();
    expect(typeof adapter.init).toBe("function");
    expect(typeof adapter.createLiveQuery).toBe("function");
    expect(typeof adapter.executeCount).toBe("function");
  });
});

describe("init and introspect", () => {
  it("introspects columns after init (explicit)", async () => {
    const { adapter } = await createTestAdapter();
    const cols = await adapter.introspect();
    expect(cols).toHaveLength(6);
    expect(cols.map((c) => c.name)).toEqual([
      "id",
      "name",
      "department",
      "salary",
      "active",
      "hired_date",
    ]);
  });

  it("introspects columns after init (from schema)", async () => {
    const collection = createTestCollection();
    await waitForReady(collection);
    const adapter = new TanStackDBAdapter({
      collection,
      schema: employeeSchema,
    });
    await adapter.init();
    const cols = await adapter.introspect();
    expect(cols).toHaveLength(6);
    expect(cols.find((c) => c.name === "salary")?.dataType).toBe("number");
    expect(cols.find((c) => c.name === "name")?.dataType).toBe("text");
    expect(cols.find((c) => c.name === "active")?.dataType).toBe("boolean");
  });

  it("getAllowedColumns returns column names", async () => {
    const { adapter } = await createTestAdapter();
    const allowed = adapter.getAllowedColumns();
    expect(allowed).toContain("id");
    expect(allowed).toContain("name");
    expect(allowed).toHaveLength(6);
  });
});

describe("executeCount", () => {
  it("counts all rows", async () => {
    const { adapter } = await createTestAdapter();
    const count = await adapter.executeCount({});
    expect(count).toBe(5);
  });

  it("counts with filter", async () => {
    const { adapter } = await createTestAdapter();
    const count = await adapter.executeCount({
      filters: [
        {
          id: "f1",
          field: "department",
          operator: "equals",
          value: "Engineering",
        },
      ],
      filterLogic: "and",
    });
    expect(count).toBe(2);
  });

  it("counts with global search", async () => {
    const { adapter } = await createTestAdapter();
    const count = await adapter.executeCount({
      globalSearch: "alice",
      searchColumns: ["name"],
    });
    // ilike match for 'Alice'
    expect(count).toBe(1);
  });
});

describe("createLiveGroupSummary", () => {
  it("returns group summaries with count via subscription", async () => {
    const { adapter } = await createTestAdapter();
    const handle = adapter.createLiveGroupSummary({
      grouping: [{ column: "department" }],
    });

    const state = await new Promise<any>((resolve) => {
      let unsub: (() => void) | undefined;
      unsub = handle.subscribe((s) => {
        if (!s.loading && s.rows.length > 0) {
          if (unsub) unsub();
          resolve(s);
        }
      });
    });

    expect(state.rows.length).toBe(3);
    const eng = state.rows.find((r: any) => r.department === "Engineering");
    expect(eng).toBeDefined();
    expect(Number(eng!._count)).toBe(2);

    await handle.destroy();
  });

  it("returns group summaries with aggregations via subscription", async () => {
    const { adapter } = await createTestAdapter();
    const handle = adapter.createLiveGroupSummary({
      grouping: [
        {
          column: "department",
          aggregations: [
            { function: "sum", column: "salary", alias: "total_salary" },
          ],
        },
      ],
    });

    const state = await new Promise<any>((resolve) => {
      let unsub: (() => void) | undefined;
      unsub = handle.subscribe((s) => {
        if (!s.loading && s.rows.length > 0) {
          if (unsub) unsub();
          resolve(s);
        }
      });
    });

    const eng = state.rows.find((r: any) => r.department === "Engineering");
    expect(Number(eng!.total_salary)).toBe(230000);

    await handle.destroy();
  });
});

describe("executeGroupCount", () => {
  it("returns number of distinct groups", async () => {
    const { adapter } = await createTestAdapter();
    const count = await adapter.executeGroupCount({
      grouping: [{ column: "department" }],
    });
    expect(count).toBe(3);
  });
});

describe("createLiveGroupDetail", () => {
  it("returns detail rows for a group via subscription", async () => {
    const { adapter } = await createTestAdapter();
    const handle = adapter.createLiveGroupDetail({
      groupValues: [{ column: "department", value: "Sales" }],
    });

    const state = await new Promise<any>((resolve) => {
      let unsub: (() => void) | undefined;
      unsub = handle.subscribe((s) => {
        if (!s.loading && s.rows.length > 0) {
          if (unsub) unsub();
          resolve(s);
        }
      });
    });

    expect(state.rows.length).toBe(2);
    expect(state.rows.every((r: any) => r.department === "Sales")).toBe(true);

    await handle.destroy();
  });
});

describe("createLiveQuery", () => {
  it("returns a LiveQueryHandle with subscribe/destroy", async () => {
    const { adapter } = await createTestAdapter();
    const handle = adapter.createLiveQuery({
      sorting: [{ column: "id", direction: "asc" }],
    });

    expect(handle).toBeDefined();
    expect(typeof handle.subscribe).toBe("function");
    expect(typeof handle.destroy).toBe("function");
    expect(typeof handle.refresh).toBe("function");
    expect(typeof handle.update).toBe("function");

    // Subscribe and wait for data
    const state = await new Promise<any>((resolve) => {
      let unsub: (() => void) | undefined;
      unsub = handle.subscribe((s) => {
        if (!s.loading && s.rows.length > 0) {
          // Defer unsubscribe in case callback fires synchronously
          if (unsub) unsub();
          resolve(s);
        }
      });
    });

    expect(state.rows.length).toBe(5);
    expect(state.fields.length).toBe(6);
    expect(state.error).toBeNull();

    await handle.destroy();
  });
});

describe("column state persistence", () => {
  it("saves and loads column state", async () => {
    const { adapter } = await createTestAdapter();
    const cols = [
      { name: "id", visible: true, width: 100, position: 0, label: null },
      {
        name: "name",
        visible: true,
        width: 200,
        position: 1,
        label: "Full Name",
      },
    ];
    await adapter.saveColumnState("grid1", cols);
    const loaded = await adapter.loadColumnState("grid1");
    expect(loaded).toEqual(cols);
  });

  it("returns empty array for unknown grid", async () => {
    const { adapter } = await createTestAdapter();
    expect(await adapter.loadColumnState("unknown")).toEqual([]);
  });
});

describe("view persistence", () => {
  const makeView = (id: string, name: string): ViewPreset => ({
    id,
    name,
    filters: [],
    filterLogic: "and",
    sorting: [],
    grouping: [],
    columnVisibility: {},
    columnOrder: [],
  });

  it("saves and loads a view", async () => {
    const { adapter } = await createTestAdapter();
    const view = makeView("v1", "Default View");
    await adapter.saveView("grid1", view);
    const loaded = await adapter.loadView("v1");
    expect(loaded).toEqual(view);
  });

  it("loads all views sorted by name", async () => {
    const { adapter } = await createTestAdapter();
    await adapter.saveView("grid1", makeView("v2", "Zebra"));
    await adapter.saveView("grid1", makeView("v1", "Alpha"));
    const views = await adapter.loadViews("grid1");
    expect(views).toHaveLength(2);
    expect(views[0].name).toBe("Alpha");
  });

  it("deletes a view", async () => {
    const { adapter } = await createTestAdapter();
    await adapter.saveView("grid1", makeView("v1", "Test"));
    await adapter.deleteView("v1");
    expect(await adapter.loadView("v1")).toBeNull();
  });

  it("sets and loads default view", async () => {
    const { adapter } = await createTestAdapter();
    const view = makeView("v1", "Default");
    await adapter.saveView("grid1", view);
    await adapter.setDefaultView("grid1", "v1");
    expect(await adapter.loadDefaultView("grid1")).toEqual(view);
  });

  it("returns null for nonexistent data", async () => {
    const { adapter } = await createTestAdapter();
    expect(await adapter.loadView("nope")).toBeNull();
    expect(await adapter.loadDefaultView("nope")).toBeNull();
  });
});

describe("getDistinctValues", () => {
  it("returns distinct values sorted", async () => {
    const { adapter } = await createTestAdapter();
    const values = await adapter.getDistinctValues("department");
    expect(values).toContain("Engineering");
    expect(values).toContain("Sales");
    expect(values).toContain("Marketing");
    // Should be sorted
    expect(values).toEqual([...values].sort());
  });

  it("throws for invalid column", async () => {
    const { adapter } = await createTestAdapter();
    await expect(adapter.getDistinctValues("nonexistent")).rejects.toThrow(
      "not in the allowed",
    );
  });
});

describe("getNumericRange", () => {
  it("returns min/max for numeric column", async () => {
    const { adapter } = await createTestAdapter();
    const range = await adapter.getNumericRange("salary");
    expect(range).not.toBeNull();
    expect(range!.min).toBe(85000);
    expect(range!.max).toBe(120000);
  });

  it("returns null for non-numeric column", async () => {
    const { adapter } = await createTestAdapter();
    const range = await adapter.getNumericRange("name");
    expect(range).toBeNull();
  });
});
