/**
 * query-translator.test.ts — Integration tests for query translation functions.
 *
 * Tests applyFilters, applyGlobalSearch, applySorting, applyPagination,
 * and applyJsonbFilters by applying them through real TanStack DB collections.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCollection,
  createLiveQueryCollection,
  localOnlyCollectionOptions,
} from "@tanstack/db";
import type { Collection } from "@tanstack/db";
import type {
  FilterNode,
  FilterCondition,
} from "@shotleybuilder/svelte-gridlite-kit/types";
import {
  applyFilters,
  applyGlobalSearch,
  applySorting,
  applyPagination,
  applyJsonbFilters,
} from "./query-translator.js";

// ─── Test data ────────────────────────────────────────────────────────────────

const SEED_DATA = [
  {
    id: 1,
    name: "Alice",
    department: "Engineering",
    salary: 120000,
    tags: { frontend: true },
  },
  {
    id: 2,
    name: "Bob",
    department: "Engineering",
    salary: 110000,
    tags: { backend: true },
  },
  {
    id: 3,
    name: "Charlie",
    department: "Sales",
    salary: 90000,
    tags: { lead: true },
  },
  { id: 4, name: "Diana", department: "Sales", salary: 95000, tags: null },
  {
    id: 5,
    name: "Eve",
    department: "Marketing",
    salary: 85000,
    tags: { social: true },
  },
];

let collection: Collection<any, any, any, any, any>;

function createTestCollection() {
  return createCollection(
    localOnlyCollectionOptions({
      id: `qt-test-${Date.now()}-${Math.random()}`,
      getKey: (item: { id: number }) => item.id,
      initialData: SEED_DATA,
    }),
  );
}

async function queryWith(
  coll: Collection<any, any, any, any, any>,
  builder: (chain: any, source: any) => any,
): Promise<Record<string, unknown>[]> {
  const queryFn = (q: any) => {
    let chain = q.from({ source: coll });
    chain = builder(chain, coll);
    return chain;
  };
  const result = createLiveQueryCollection(queryFn);
  return (await result.toArrayWhenReady()) as unknown as Record<
    string,
    unknown
  >[];
}

beforeEach(() => {
  collection = createTestCollection();
});

// ─── applyFilters ─────────────────────────────────────────────────────────────

describe("applyFilters", () => {
  it("returns all rows when no filters", async () => {
    const rows = await queryWith(collection, (chain) => applyFilters(chain));
    expect(rows.length).toBe(5);
  });

  it("applies single AND filter", async () => {
    const filters: FilterNode[] = [
      {
        id: "f1",
        field: "department",
        operator: "equals",
        value: "Engineering",
      },
    ];
    const rows = await queryWith(collection, (chain) =>
      applyFilters(chain, filters, "and"),
    );
    expect(rows.length).toBe(2);
  });

  it("applies multiple AND filters", async () => {
    const filters: FilterNode[] = [
      {
        id: "f1",
        field: "department",
        operator: "equals",
        value: "Engineering",
      },
      { id: "f2", field: "salary", operator: "greater_than", value: 115000 },
    ];
    const rows = await queryWith(collection, (chain) =>
      applyFilters(chain, filters, "and"),
    );
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Alice");
  });

  it("applies OR logic", async () => {
    const filters: FilterNode[] = [
      { id: "f1", field: "department", operator: "equals", value: "Marketing" },
      { id: "f2", field: "name", operator: "equals", value: "Alice" },
    ];
    const rows = await queryWith(collection, (chain) =>
      applyFilters(chain, filters, "or"),
    );
    expect(rows.length).toBe(2);
    const names = rows.map((r) => r.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Eve");
  });

  it("handles nested filter groups", async () => {
    const filters: FilterNode[] = [
      {
        id: "g1",
        logic: "or",
        children: [
          {
            id: "f1",
            field: "department",
            operator: "equals",
            value: "Engineering",
          },
          {
            id: "f2",
            field: "department",
            operator: "equals",
            value: "Marketing",
          },
        ],
      },
    ];
    const rows = await queryWith(collection, (chain) =>
      applyFilters(chain, filters, "and"),
    );
    expect(rows.length).toBe(3); // Alice, Bob, Eve
  });

  it("skips conditions with no field", async () => {
    const filters: FilterNode[] = [
      { id: "f1", field: "", operator: "equals", value: "Engineering" },
    ];
    const rows = await queryWith(collection, (chain) =>
      applyFilters(chain, filters, "and"),
    );
    expect(rows.length).toBe(5); // no-op
  });
});

// ─── applyGlobalSearch ────────────────────────────────────────────────────────

describe("applyGlobalSearch", () => {
  it("returns all rows when no search term", async () => {
    const rows = await queryWith(collection, (chain) =>
      applyGlobalSearch(chain, undefined, ["name", "department"]),
    );
    expect(rows.length).toBe(5);
  });

  it("searches across specified columns", async () => {
    const rows = await queryWith(collection, (chain) =>
      applyGlobalSearch(chain, "ali", ["name"]),
    );
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Alice");
  });

  it("searches across multiple columns", async () => {
    const rows = await queryWith(collection, (chain) =>
      applyGlobalSearch(chain, "engineer", ["name", "department"]),
    );
    expect(rows.length).toBe(2); // Engineering department
  });

  it("returns no results when no columns provided", async () => {
    const rows = await queryWith(collection, (chain) =>
      applyGlobalSearch(chain, "alice", []),
    );
    expect(rows.length).toBe(5); // no-op when empty columns
  });
});

// ─── applySorting ─────────────────────────────────────────────────────────────

describe("applySorting", () => {
  it("returns unsorted when no sorting specified", async () => {
    const rows = await queryWith(collection, (chain) => applySorting(chain));
    expect(rows.length).toBe(5);
  });

  it("sorts ascending", async () => {
    const rows = await queryWith(collection, (chain) =>
      applySorting(chain, [{ column: "salary", direction: "asc" }]),
    );
    const salaries = rows.map((r) => r.salary);
    expect(salaries).toEqual([85000, 90000, 95000, 110000, 120000]);
  });

  it("sorts descending", async () => {
    const rows = await queryWith(collection, (chain) =>
      applySorting(chain, [{ column: "salary", direction: "desc" }]),
    );
    const salaries = rows.map((r) => r.salary);
    expect(salaries).toEqual([120000, 110000, 95000, 90000, 85000]);
  });

  it("sorts by multiple columns", async () => {
    const rows = await queryWith(collection, (chain) =>
      applySorting(chain, [
        { column: "department", direction: "asc" },
        { column: "salary", direction: "desc" },
      ]),
    );
    // Engineering (Alice 120k, Bob 110k), Marketing (Eve), Sales (Diana 95k, Charlie 90k)
    expect(rows[0].name).toBe("Alice");
    expect(rows[1].name).toBe("Bob");
    expect(rows[2].name).toBe("Eve");
  });
});

// ─── applyPagination ──────────────────────────────────────────────────────────

describe("applyPagination", () => {
  it("returns all rows when no pagination", async () => {
    const rows = await queryWith(collection, (chain) => applyPagination(chain));
    expect(rows.length).toBe(5);
  });

  it("limits results to page size", async () => {
    const rows = await queryWith(collection, (chain) => {
      // Sort first since pagination requires ordering
      let c = applySorting(chain, [{ column: "id", direction: "asc" }]);
      return applyPagination(c, 0, 2, true);
    });
    expect(rows.length).toBe(2);
  });

  it("applies offset for subsequent pages", async () => {
    const rows = await queryWith(collection, (chain) => {
      let c = applySorting(chain, [{ column: "id", direction: "asc" }]);
      return applyPagination(c, 1, 2, true);
    });
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe("Charlie"); // id=3
    expect(rows[1].name).toBe("Diana"); // id=4
  });

  it("adds default sort when pagination without ordering", async () => {
    const rows = await queryWith(collection, (chain) =>
      applyPagination(chain, 0, 3, false, "id"),
    );
    expect(rows.length).toBe(3);
  });
});

// ─── applyJsonbFilters ────────────────────────────────────────────────────────

describe("applyJsonbFilters", () => {
  it("returns all rows when no JSONB filters", async () => {
    const rows = await queryWith(collection, (chain) =>
      applyJsonbFilters(chain),
    );
    expect(rows.length).toBe(5);
  });

  it("filters with jsonb_has_key", async () => {
    const filters: FilterNode[] = [
      { id: "f1", field: "tags", operator: "jsonb_has_key", value: "frontend" },
    ];
    const rows = await queryWith(collection, (chain) =>
      applyJsonbFilters(chain, filters),
    );
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Alice");
  });

  it("filters with jsonb_not_has_key", async () => {
    const filters: FilterNode[] = [
      {
        id: "f1",
        field: "tags",
        operator: "jsonb_not_has_key",
        value: "frontend",
      },
    ];
    const rows = await queryWith(collection, (chain) =>
      applyJsonbFilters(chain, filters),
    );
    // Everyone except Alice (and Diana has null tags → not has key = true)
    expect(rows.length).toBe(4);
  });

  it("handles nested JSONB conditions in filter groups", async () => {
    const filters: FilterNode[] = [
      {
        id: "g1",
        logic: "and",
        children: [
          { id: "f1", field: "tags", operator: "jsonb_has_key", value: "lead" },
        ],
      },
    ];
    const rows = await queryWith(collection, (chain) =>
      applyJsonbFilters(chain, filters),
    );
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Charlie");
  });
});

// ─── Combined filters + search ────────────────────────────────────────────────

describe("combined operations", () => {
  it("filters then searches then sorts then paginates", async () => {
    const filters: FilterNode[] = [
      { id: "f1", field: "salary", operator: "greater_or_equal", value: 90000 },
    ];
    const rows = await queryWith(collection, (chain) => {
      chain = applyFilters(chain, filters, "and");
      chain = applyGlobalSearch(chain, "engi", ["department"]);
      chain = applySorting(chain, [{ column: "salary", direction: "desc" }]);
      chain = applyPagination(chain, 0, 1, true);
      return chain;
    });
    // Filtered: salary >= 90k → Alice, Bob, Charlie, Diana
    // Search: Engineering → Alice, Bob
    // Sorted desc: Alice (120k), Bob (110k)
    // Page 0, size 1: Alice
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Alice");
  });
});
