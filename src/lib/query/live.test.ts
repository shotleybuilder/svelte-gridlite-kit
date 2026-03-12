import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import {
  createLiveQueryStore,
  createLiveQueryStoreFromQuery,
  type PGliteWithLive,
} from "./live.js";

describe("createLiveQueryStore", () => {
  let db: PGliteWithLive;

  beforeAll(async () => {
    db = new PGlite({ extensions: { live } }) as PGliteWithLive;
    await db.exec(`
			CREATE TABLE users (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				active BOOLEAN DEFAULT true
			)
		`);
    await db.exec(`
			INSERT INTO users (name, active) VALUES
				('Alice', true),
				('Bob', true),
				('Charlie', false)
		`);
  });

  afterAll(async () => {
    await db.close();
  });

  it("delivers initial results via subscribe", async () => {
    const store = createLiveQueryStore<{
      id: number;
      name: string;
      active: boolean;
    }>(db, "SELECT * FROM users ORDER BY id");

    const state = await waitForLoaded(store);

    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.rows).toHaveLength(3);
    expect(state.rows[0].name).toBe("Alice");
    expect(state.rows[1].name).toBe("Bob");
    expect(state.rows[2].name).toBe("Charlie");
    expect(state.fields.length).toBeGreaterThan(0);
    expect(state.fields.map((f) => f.name)).toContain("name");

    await store.destroy();
  });

  it("delivers parameterized query results", async () => {
    const store = createLiveQueryStore<{
      id: number;
      name: string;
      active: boolean;
    }>(db, "SELECT * FROM users WHERE active = $1 ORDER BY id", [true]);

    const state = await waitForLoaded(store);

    expect(state.rows).toHaveLength(2);
    expect(state.rows.map((r) => r.name)).toEqual(["Alice", "Bob"]);

    await store.destroy();
  });

  it("reactively updates when data changes", async () => {
    const store = createLiveQueryStore<{
      id: number;
      name: string;
      active: boolean;
    }>(db, "SELECT * FROM users WHERE active = $1 ORDER BY id", [true]);

    // Wait for initial load
    await waitForLoaded(store);

    // Insert a new active user
    const statePromise = waitForRowCount(store, 3);
    await db.exec(`INSERT INTO users (name, active) VALUES ('Diana', true)`);
    const state = await statePromise;

    expect(state.rows).toHaveLength(3);
    expect(state.rows.map((r) => r.name)).toContain("Diana");

    await store.destroy();

    // Cleanup
    await db.exec(`DELETE FROM users WHERE name = 'Diana'`);
  });

  it("handles update() to change query", async () => {
    const store = createLiveQueryStore<{
      id: number;
      name: string;
      active: boolean;
    }>(db, "SELECT * FROM users WHERE active = $1 ORDER BY id", [true]);

    let state = await waitForLoaded(store);
    expect(state.rows).toHaveLength(2);

    // Switch to inactive users
    await store.update("SELECT * FROM users WHERE active = $1 ORDER BY id", [
      false,
    ]);
    state = await waitForLoaded(store);

    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].name).toBe("Charlie");

    await store.destroy();
  });

  it("delivers error state for invalid SQL", async () => {
    const store = createLiveQueryStore(db, "SELECT * FROM nonexistent_table");

    const state = await waitForState(
      store,
      (s) => s.error !== null || !s.loading,
    );

    expect(state.error).toBeInstanceOf(Error);
    expect(state.loading).toBe(false);

    await store.destroy();
  });

  it("unsubscribe stops callbacks", async () => {
    const store = createLiveQueryStore(db, "SELECT * FROM users ORDER BY id");

    let callCount = 0;
    const unsub = store.subscribe(() => {
      callCount++;
    });

    // Initial call
    expect(callCount).toBe(1);

    unsub();

    // Trigger a refresh — should NOT increment callCount
    await store.refresh();
    // Give it a tick
    await new Promise((r) => setTimeout(r, 50));

    expect(callCount).toBe(1);

    await store.destroy();
  });

  it("destroy cleans up all subscriptions", async () => {
    const store = createLiveQueryStore(db, "SELECT * FROM users ORDER BY id");

    let lastState: any = null;
    store.subscribe((s) => {
      lastState = s;
    });

    await waitForLoaded(store);
    await store.destroy();

    // After destroy, insert should not trigger updates
    await db.exec(`INSERT INTO users (name, active) VALUES ('Eve', true)`);
    await new Promise((r) => setTimeout(r, 100));

    // lastState should still be the pre-destroy state
    expect(lastState.rows.map((r: any) => r.name)).not.toContain("Eve");

    // Cleanup
    await db.exec(`DELETE FROM users WHERE name = 'Eve'`);
  });
});

describe("createLiveQueryStoreFromQuery", () => {
  let db: PGliteWithLive;

  beforeAll(async () => {
    db = new PGlite({ extensions: { live } }) as PGliteWithLive;
    await db.exec(`
			CREATE TABLE items (id SERIAL PRIMARY KEY, label TEXT)
		`);
    await db.exec(`INSERT INTO items (label) VALUES ('one'), ('two')`);
  });

  afterAll(async () => {
    await db.close();
  });

  it("accepts a ParameterizedQuery object", async () => {
    const store = createLiveQueryStoreFromQuery<{ id: number; label: string }>(
      db,
      {
        sql: "SELECT * FROM items ORDER BY id",
        params: [],
      },
    );

    const state = await waitForLoaded(store);
    expect(state.rows).toHaveLength(2);
    expect(state.rows[0].label).toBe("one");

    await store.destroy();
  });
});

// ─── Test Helpers ───────────────────────────────────────────────────────────

function waitForLoaded<T>(
  store: ReturnType<typeof createLiveQueryStore<T>>,
  timeout = 5000,
): Promise<{
  rows: T[];
  fields: any[];
  loading: boolean;
  error: Error | null;
  totalCount?: number;
}> {
  return waitForState(store, (s) => !s.loading, timeout);
}

function waitForState<T>(
  store: ReturnType<typeof createLiveQueryStore<T>>,
  predicate: (state: any) => boolean,
  timeout = 5000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("waitForState timed out"));
    }, timeout);

    let resolved = false;
    const unsub = store.subscribe((state) => {
      if (!resolved && predicate(state)) {
        resolved = true;
        clearTimeout(timer);
        // Defer unsubscribe to avoid calling unsub before it's assigned
        queueMicrotask(() => unsub());
        resolve(state);
      }
    });
  });
}

function waitForRowCount<T>(
  store: ReturnType<typeof createLiveQueryStore<T>>,
  count: number,
  timeout = 5000,
): Promise<any> {
  return waitForState(
    store,
    (s) => !s.loading && s.rows.length === count,
    timeout,
  );
}
