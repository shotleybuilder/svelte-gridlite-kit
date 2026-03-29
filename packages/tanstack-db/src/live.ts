/**
 * live.ts — Bridges TanStack DB live query collections to GridLite's
 * LiveQueryHandle / LiveQueryState contract.
 *
 * Uses createLiveQueryCollection (framework-agnostic, no Svelte context needed)
 * and subscribeChanges() for reactivity.
 */

import { createLiveQueryCollection } from "@tanstack/db";
import type { Collection } from "@tanstack/db";
import type {
  LiveQueryHandle,
  LiveQueryState,
  QueryDescriptor,
} from "@shotleybuilder/svelte-gridlite-kit/adapter";
import type { ColumnMetadata } from "@shotleybuilder/svelte-gridlite-kit/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilderFn = (q: any) => any;

export interface LiveQueryConfig {
  /** Source collection to query against */
  sourceCollection: Collection;
  /** Column metadata for synthesizing fields */
  columns: ColumnMetadata[];
  /** Function that builds a query chain from a descriptor */
  buildQueryFn: (descriptor: QueryDescriptor) => QueryBuilderFn;
  /** Initial query descriptor */
  initialQuery: QueryDescriptor;
}

/**
 * Wait for a collection to reach 'ready' status.
 * Uses toArrayWhenReady() which triggers preload() internally,
 * ensuring the D2 pipeline starts even without subscribers.
 */
export function waitForReady(collection: Collection): Promise<void> {
  if (collection.status === "ready") {
    return Promise.resolve();
  }
  return collection.toArrayWhenReady().then(() => {});
}

/**
 * Create a LiveQueryHandle that wraps a TanStack DB live query collection.
 */
export function createLiveQueryHandle(
  config: LiveQueryConfig,
): LiveQueryHandle {
  const { sourceCollection, columns, buildQueryFn } = config;
  let currentQuery = config.initialQuery;
  let destroyed = false;

  const subscribers = new Set<(state: LiveQueryState) => void>();
  const fields = columns.map((c) => ({ name: c.name, dataTypeID: 0 }));

  // Create the initial live query collection
  let liveCollection = createLiveQueryCollection(buildQueryFn(currentQuery));
  let subscription = subscribeTo(liveCollection);

  function buildState(coll: Collection): LiveQueryState {
    const isReady = coll.status === "ready";
    return {
      rows: isReady
        ? (coll.toArray as unknown[] as Record<string, unknown>[])
        : [],
      fields,
      loading: !isReady,
      error: coll.status === "error" ? new Error("Collection error") : null,
    };
  }

  function notify(coll: Collection) {
    if (destroyed) return;
    const state = buildState(coll);
    for (const cb of subscribers) {
      cb(state);
    }
  }

  function subscribeTo(coll: Collection) {
    return coll.subscribeChanges(() => notify(coll), {
      includeInitialState: true,
    });
  }

  return {
    subscribe(callback: (state: LiveQueryState) => void): () => void {
      subscribers.add(callback);
      // Immediate delivery per Svelte store contract
      callback(buildState(liveCollection));
      return () => {
        subscribers.delete(callback);
      };
    },

    async refresh(): Promise<void> {
      notify(liveCollection);
    },

    async update(newQuery: QueryDescriptor): Promise<void> {
      if (destroyed) return;
      currentQuery = newQuery;
      // Tear down old subscription
      subscription.unsubscribe();
      // Create new live query collection
      liveCollection = createLiveQueryCollection(buildQueryFn(currentQuery));
      subscription = subscribeTo(liveCollection);
    },

    async destroy(): Promise<void> {
      destroyed = true;
      subscription.unsubscribe();
      subscribers.clear();
    },
  };
}
