/**
 * operator-map.test.ts — Integration tests for operator mapping.
 *
 * Tests each FilterOperator by applying it through a real TanStack DB
 * collection query and verifying the resulting rows.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createCollection,
  createLiveQueryCollection,
  localOnlyCollectionOptions,
} from "@tanstack/db";
import type { Collection } from "@tanstack/db";
import type { FilterCondition } from "@shotleybuilder/svelte-gridlite-kit/types";
import { applyFilters } from "./query-translator.js";

// ─── Test data ────────────────────────────────────────────────────────────────

const SEED_DATA = [
  {
    id: 1,
    name: "Alice",
    department: "Engineering",
    salary: 120000,
    active: true,
    hired_date: "2020-01-15",
    metadata: { level: "senior" },
  },
  {
    id: 2,
    name: "Bob",
    department: "Engineering",
    salary: 110000,
    active: true,
    hired_date: "2021-03-01",
    metadata: { level: "mid" },
  },
  {
    id: 3,
    name: "Charlie",
    department: "Sales",
    salary: 90000,
    active: true,
    hired_date: "2019-06-20",
    metadata: { level: "senior" },
  },
  {
    id: 4,
    name: "Diana",
    department: "Sales",
    salary: 95000,
    active: false,
    hired_date: "2018-11-10",
    metadata: null,
  },
  {
    id: 5,
    name: "Eve",
    department: "Marketing",
    salary: 85000,
    active: true,
    hired_date: "2022-07-01",
    metadata: { level: "junior" },
  },
];

let collection: Collection<any, any, any, any, any>;

function createTestCollection() {
  return createCollection(
    localOnlyCollectionOptions({
      id: `op-test-${Date.now()}-${Math.random()}`,
      getKey: (item: { id: number }) => item.id,
      initialData: SEED_DATA,
    }),
  );
}

async function queryWithFilter(
  coll: Collection<any, any, any, any, any>,
  condition: FilterCondition,
): Promise<Record<string, unknown>[]> {
  const queryFn = (q: any) => {
    let chain = q.from({ source: coll });
    chain = applyFilters(chain, [condition], "and");
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("equals", () => {
  it("matches exact string value", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "department",
      operator: "equals",
      value: "Sales",
    });
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.department === "Sales")).toBe(true);
  });

  it("matches exact numeric value", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "salary",
      operator: "equals",
      value: 120000,
    });
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Alice");
  });
});

describe("not_equals", () => {
  it("excludes matching rows", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "department",
      operator: "not_equals",
      value: "Engineering",
    });
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.department !== "Engineering")).toBe(true);
  });
});

describe("contains", () => {
  it("matches substring (case insensitive)", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "name",
      operator: "contains",
      value: "li",
    });
    // Alice, Charlie
    expect(rows.length).toBe(2);
    const names = rows.map((r) => r.name);
    expect(names).toContain("Alice");
    expect(names).toContain("Charlie");
  });
});

describe("not_contains", () => {
  it("excludes substring matches", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "name",
      operator: "not_contains",
      value: "li",
    });
    expect(rows.length).toBe(3);
    const names = rows.map((r) => r.name);
    expect(names).not.toContain("Alice");
    expect(names).not.toContain("Charlie");
  });
});

describe("starts_with", () => {
  it("matches prefix (case insensitive)", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "name",
      operator: "starts_with",
      value: "al",
    });
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Alice");
  });
});

describe("ends_with", () => {
  it("matches suffix (case insensitive)", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "name",
      operator: "ends_with",
      value: "e",
    });
    // Alice, Charlie, Eve
    expect(rows.length).toBe(3);
  });
});

describe("greater_than", () => {
  it("filters numerics", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "salary",
      operator: "greater_than",
      value: 100000,
    });
    expect(rows.length).toBe(2); // Alice 120k, Bob 110k
  });
});

describe("less_than", () => {
  it("filters numerics", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "salary",
      operator: "less_than",
      value: 95000,
    });
    expect(rows.length).toBe(2); // Charlie 90k, Eve 85k
  });
});

describe("greater_or_equal", () => {
  it("includes boundary", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "salary",
      operator: "greater_or_equal",
      value: 95000,
    });
    expect(rows.length).toBe(3); // Alice, Bob, Diana
  });
});

describe("less_or_equal", () => {
  it("includes boundary", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "salary",
      operator: "less_or_equal",
      value: 90000,
    });
    expect(rows.length).toBe(2); // Charlie 90k, Eve 85k
  });
});

describe("is_after / is_before", () => {
  it("is_after filters dates", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "hired_date",
      operator: "is_after",
      value: "2021-01-01",
    });
    expect(rows.length).toBe(2); // Bob 2021-03, Eve 2022-07
  });

  it("is_before filters dates", async () => {
    const rows = await queryWithFilter(collection, {
      id: "f1",
      field: "hired_date",
      operator: "is_before",
      value: "2020-01-01",
    });
    expect(rows.length).toBe(2); // Charlie 2019, Diana 2018
  });
});

describe("intervalOffset", () => {
  it("throws for interval offset", async () => {
    const { translateCondition } = await import("./operator-map.js");
    expect(() => {
      translateCondition(
        {}, // dummy field ref
        {
          id: "f1",
          field: "hired_date",
          operator: "greater_than",
          value: "now",
          valueColumn: "hired_date",
          intervalOffset: "1 year",
        },
        () => ({}),
      );
    }).toThrow("does not support interval offsets");
  });
});

describe("unknown operator", () => {
  it("returns null for unmapped operator", async () => {
    const { translateCondition } = await import("./operator-map.js");
    const result = translateCondition(
      {},
      { id: "f1", field: "x", operator: "unknown_op" as any, value: "" },
    );
    expect(result).toBeNull();
  });
});
