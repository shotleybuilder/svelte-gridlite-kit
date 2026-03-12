/**
 * Svelte Store Wrapper for PGLite Live Queries
 *
 * Bridges PGLite's live.query() API with Svelte's store contract.
 * Provides loading/error/data states and handles subscription lifecycle.
 *
 * Usage:
 *   const store = createLiveQueryStore(db, 'SELECT * FROM users WHERE active = $1', [true]);
 *   // In Svelte: $store.rows, $store.loading, $store.error
 *   // Call store.destroy() on component unmount
 */

import type { PGlite, Results } from '@electric-sql/pglite';
import type { LiveNamespace, LiveQueryResults } from '@electric-sql/pglite/live';
import type { ParameterizedQuery } from '../types.js';

// ─── Store Types ────────────────────────────────────────────────────────────

export interface LiveQueryState<T = Record<string, unknown>> {
	rows: T[];
	fields: { name: string; dataTypeID: number }[];
	totalCount?: number;
	loading: boolean;
	error: Error | null;
}

export interface LiveQueryStore<T = Record<string, unknown>> {
	subscribe: (callback: (state: LiveQueryState<T>) => void) => () => void;
	refresh: () => Promise<void>;
	update: (query: string, params?: unknown[]) => Promise<void>;
	destroy: () => Promise<void>;
}

// ─── PGlite with Live Extension ─────────────────────────────────────────────

/** A PGLite instance that has the live extension loaded */
export type PGliteWithLive = PGlite & { live: LiveNamespace };

// ─── Store Factory ──────────────────────────────────────────────────────────

/**
 * Create a Svelte-compatible store backed by a PGLite live query.
 *
 * The store follows Svelte's store contract (has a `subscribe` method that
 * returns an unsubscribe function). It also exposes `refresh`, `update`,
 * and `destroy` methods.
 *
 * @param db - PGLite instance with the live extension loaded
 * @param query - SQL query string with $1, $2, ... parameters
 * @param params - Parameter values for the query
 */
export function createLiveQueryStore<T = Record<string, unknown>>(
	db: PGliteWithLive,
	query: string,
	params: unknown[] = []
): LiveQueryStore<T> {
	let state: LiveQueryState<T> = {
		rows: [],
		fields: [],
		loading: true,
		error: null
	};

	const subscribers = new Set<(state: LiveQueryState<T>) => void>();

	// Internal unsubscribe from PGLite live query
	let liveUnsubscribe: ((cb?: (results: LiveQueryResults<T>) => void) => Promise<void>) | null = null;
	let liveRefresh: ((options?: { offset?: number; limit?: number }) => Promise<void>) | null = null;
	let destroyed = false;

	function notify() {
		for (const cb of subscribers) {
			cb(state);
		}
	}

	function setState(partial: Partial<LiveQueryState<T>>) {
		state = { ...state, ...partial };
		notify();
	}

	function handleResults(results: LiveQueryResults<T>) {
		setState({
			rows: results.rows as T[],
			fields: results.fields,
			totalCount: results.totalCount,
			loading: false,
			error: null
		});
	}

	async function setupLiveQuery(sql: string, queryParams: unknown[]) {
		// Tear down existing subscription
		if (liveUnsubscribe) {
			await liveUnsubscribe();
			liveUnsubscribe = null;
			liveRefresh = null;
		}

		if (destroyed) return;

		setState({ loading: true, error: null });

		try {
			const liveQuery = await db.live.query<T>(sql, queryParams as any[], handleResults);

			if (destroyed) {
				// Component was destroyed while we were setting up
				await liveQuery.unsubscribe();
				return;
			}

			liveUnsubscribe = liveQuery.unsubscribe;
			liveRefresh = liveQuery.refresh;

			// Initial results are delivered via the callback, but also available here
			handleResults(liveQuery.initialResults);
		} catch (err) {
			setState({
				loading: false,
				error: err instanceof Error ? err : new Error(String(err))
			});
		}
	}

	// Start the initial live query
	setupLiveQuery(query, params);

	return {
		subscribe(callback: (state: LiveQueryState<T>) => void) {
			subscribers.add(callback);
			// Immediately deliver current state (Svelte store contract)
			callback(state);

			return () => {
				subscribers.delete(callback);
			};
		},

		async refresh() {
			if (liveRefresh) {
				await liveRefresh();
			}
		},

		async update(newQuery: string, newParams: unknown[] = []) {
			await setupLiveQuery(newQuery, newParams);
		},

		async destroy() {
			destroyed = true;
			if (liveUnsubscribe) {
				await liveUnsubscribe();
				liveUnsubscribe = null;
				liveRefresh = null;
			}
			subscribers.clear();
		}
	};
}

/**
 * Convenience: create a live query store from a ParameterizedQuery object.
 */
export function createLiveQueryStoreFromQuery<T = Record<string, unknown>>(
	db: PGliteWithLive,
	parameterizedQuery: ParameterizedQuery
): LiveQueryStore<T> {
	return createLiveQueryStore<T>(db, parameterizedQuery.sql, parameterizedQuery.params);
}
