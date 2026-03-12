<script lang="ts">
	/**
	 * GridLite — SQL-native data grid component
	 *
	 * Accepts a PGLite instance + table name (or raw query).
	 * All UI operations (filter, sort, group, paginate) translate to SQL.
	 * PGLite live queries push reactive updates to the UI.
	 */

	import { onMount, onDestroy } from 'svelte';
	import type {
		GridConfig,
		GridFeatures,
		GridState,
		FilterCondition,
		FilterLogic,
		SortConfig,
		GroupConfig,
		ColumnMetadata,
		ClassNameMap,
		RowHeight,
		ColumnSpacing
	} from './types.js';
	import { introspectTable, getColumnNames } from './query/schema.js';
	import { buildQuery, buildCountQuery } from './query/builder.js';
	import {
		createLiveQueryStore,
		type PGliteWithLive,
		type LiveQueryStore,
		type LiveQueryState
	} from './query/live.js';
	import { runMigrations } from './state/migrations.js';
	import FilterBar from './components/FilterBar.svelte';

	// ─── Props ────────────────────────────────────────────────────────────────

	/** PGLite instance with the live extension loaded */
	export let db: PGliteWithLive;

	/** Table name to query (mutually exclusive with `query`) */
	export let table: string | undefined = undefined;

	/** Raw SQL query (mutually exclusive with `table`) */
	export let query: string | undefined = undefined;

	/** Grid configuration */
	export let config: GridConfig | undefined = undefined;

	/** Feature flags */
	export let features: GridFeatures = {};

	/** Custom CSS class names */
	export let classNames: Partial<ClassNameMap> = {};

	/** Row height variant */
	export let rowHeight: RowHeight = 'medium';

	/** Column spacing variant */
	export let columnSpacing: ColumnSpacing = 'normal';

	/** Row click callback */
	export let onRowClick: ((row: Record<string, unknown>) => void) | undefined = undefined;

	/** State change callback */
	export let onStateChange: ((state: GridState) => void) | undefined = undefined;

	// ─── Internal State ───────────────────────────────────────────────────────

	let columns: ColumnMetadata[] = [];
	let allowedColumns: string[] = [];
	let initialized = false;
	let error: string | null = null;

	// Grid state
	let filters: FilterCondition[] = config?.defaultFilters ?? [];
	let filterLogic: FilterLogic = config?.filterLogic ?? 'and';
	let sorting: SortConfig[] = config?.defaultSorting ?? [];
	let grouping: GroupConfig[] = config?.defaultGrouping ?? [];
	let page = 0;
	let pageSize = config?.pagination?.pageSize ?? 25;
	let totalRows = 0;

	// Filter UI state
	let filterExpanded = false;

	// Live query store
	let store: LiveQueryStore | null = null;
	let storeState: LiveQueryState = {
		rows: [],
		fields: [],
		loading: true,
		error: null
	};

	// ─── Computed ─────────────────────────────────────────────────────────────

	$: totalPages = pageSize > 0 ? Math.ceil(totalRows / pageSize) : 0;

	$: containerClass = [
		'gridlite-container',
		`gridlite-row-${rowHeight}`,
		`gridlite-spacing-${columnSpacing}`,
		classNames.container ?? ''
	].filter(Boolean).join(' ');

	// Visible columns (respecting config)
	$: visibleColumns = columns.filter((col) => {
		if (config?.defaultVisibleColumns) {
			return config.defaultVisibleColumns.includes(col.name);
		}
		return true;
	});

	// Ordered columns
	$: orderedColumns = (() => {
		if (config?.defaultColumnOrder && config.defaultColumnOrder.length > 0) {
			const order = config.defaultColumnOrder;
			return [...visibleColumns].sort((a, b) => {
				const ai = order.indexOf(a.name);
				const bi = order.indexOf(b.name);
				if (ai === -1 && bi === -1) return 0;
				if (ai === -1) return 1;
				if (bi === -1) return -1;
				return ai - bi;
			});
		}
		return visibleColumns;
	})();

	// ─── Query Building & Subscription ────────────────────────────────────────

	async function init() {
		try {
			// Run migrations for state persistence
			await runMigrations(db);

			if (table) {
				// Introspect schema
				columns = await introspectTable(db, table);
				allowedColumns = columns.map((c) => c.name);

				if (columns.length === 0) {
					error = `Table "${table}" not found or has no columns`;
					return;
				}
			}

			initialized = true;
			await rebuildQuery();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function rebuildQuery() {
		if (!initialized) return;

		// Destroy previous store
		if (store) {
			await store.destroy();
			store = null;
		}

		let sql: string;
		let params: unknown[] = [];

		if (query) {
			// Raw query mode — use as-is
			sql = query;
		} else if (table) {
			// Table mode — build query from state
			const usePagination = features.pagination !== false;
			const built = buildQuery({
				table,
				filters,
				filterLogic,
				sorting,
				grouping,
				page: usePagination ? page : undefined,
				pageSize: usePagination ? pageSize : undefined,
				allowedColumns
			});
			sql = built.sql;
			params = built.params;

			// Get total count for pagination
			if (usePagination) {
				await updateTotalCount();
			}
		} else {
			error = 'Either `table` or `query` prop is required';
			return;
		}

		// Create live query store
		store = createLiveQueryStore(db, sql, params);
		store.subscribe((state) => {
			storeState = state;
		});
	}

	async function updateTotalCount() {
		if (!table) return;
		try {
			const countQuery = buildCountQuery({
				table,
				filters,
				filterLogic,
				allowedColumns
			});
			const result = await db.query<{ total: string }>(countQuery.sql, countQuery.params as any[]);
			totalRows = parseInt(result.rows[0]?.total ?? '0', 10);
		} catch {
			totalRows = 0;
		}
	}

	// ─── Public Methods (for sub-components in future sessions) ───────────────

	export function setFilters(newFilters: FilterCondition[], logic?: FilterLogic) {
		filters = newFilters;
		if (logic) filterLogic = logic;
		page = 0; // Reset to first page
		rebuildQuery();
		notifyStateChange();
	}

	export function setSorting(newSorting: SortConfig[]) {
		sorting = newSorting;
		rebuildQuery();
		notifyStateChange();
	}

	export function setGrouping(newGrouping: GroupConfig[]) {
		grouping = newGrouping;
		rebuildQuery();
		notifyStateChange();
	}

	export function setPage(newPage: number) {
		page = Math.max(0, Math.min(newPage, totalPages - 1));
		rebuildQuery();
		notifyStateChange();
	}

	export function setPageSize(newPageSize: number) {
		pageSize = newPageSize;
		page = 0;
		rebuildQuery();
		notifyStateChange();
	}

	function notifyStateChange() {
		if (onStateChange) {
			onStateChange({
				columnVisibility: Object.fromEntries(visibleColumns.map((c) => [c.name, true])),
				columnOrder: orderedColumns.map((c) => c.name),
				columnSizing: {},
				filters,
				filterLogic,
				sorting,
				grouping,
				globalFilter: '',
				pagination: { page, pageSize, totalRows, totalPages }
			});
		}
	}

	// ─── FilterBar handlers ───────────────────────────────────────────────────

	function handleFiltersChange(newFilters: FilterCondition[]) {
		setFilters(newFilters, filterLogic);
	}

	function handleLogicChange(newLogic: FilterLogic) {
		filterLogic = newLogic;
		page = 0;
		rebuildQuery();
		notifyStateChange();
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────

	onMount(() => {
		init();
	});

	onDestroy(() => {
		if (store) {
			store.destroy();
		}
	});
</script>

<div class={containerClass}>
	{#if error}
		<div class="gridlite-empty">{error}</div>
	{:else if !initialized || storeState.loading}
		<div class="gridlite-loading">Loading...</div>
	{:else if storeState.error}
		<div class="gridlite-empty">Error: {storeState.error.message}</div>
	{:else}
		{#if features.filtering && table}
			<div class="gridlite-toolbar">
				<FilterBar
					{db}
					{table}
					{columns}
					columnConfigs={config?.columns ?? []}
					{allowedColumns}
					conditions={filters}
					onConditionsChange={handleFiltersChange}
					logic={filterLogic}
					onLogicChange={handleLogicChange}
					isExpanded={filterExpanded}
					onExpandedChange={(expanded) => (filterExpanded = expanded)}
				/>
			</div>
		{/if}

		<table class={`gridlite-table ${classNames.table ?? ''}`}>
			<thead class={`gridlite-thead ${classNames.thead ?? ''}`}>
				<tr class={classNames.tr ?? ''}>
					{#each orderedColumns as col}
						<th class={`gridlite-th ${classNames.th ?? ''}`}>
							{#if config?.columns}
								{@const colConfig = config.columns.find((c) => c.name === col.name)}
								{colConfig?.label ?? col.name}
							{:else}
								{col.name}
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class={`gridlite-tbody ${classNames.tbody ?? ''}`}>
				{#if storeState.rows.length === 0}
					<tr>
						<td colspan={orderedColumns.length} class="gridlite-empty">
							No data
						</td>
					</tr>
				{:else}
					{#each storeState.rows as row}
						<tr
							class={`gridlite-tr ${classNames.tr ?? ''}`}
							on:click={() => onRowClick?.(row)}
							role={onRowClick ? 'button' : undefined}
							tabindex={onRowClick ? 0 : undefined}
							on:keydown={(e) => {
								if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
									e.preventDefault();
									onRowClick(row);
								}
							}}
						>
							{#each orderedColumns as col}
								<td class={`gridlite-td ${classNames.td ?? ''}`}>
									{#if config?.columns}
										{@const colConfig = config.columns.find((c) => c.name === col.name)}
										{#if colConfig?.format}
											{colConfig.format(row[col.name])}
										{:else}
											{row[col.name] ?? ''}
										{/if}
									{:else}
										{row[col.name] ?? ''}
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>

		{#if features.pagination !== false && totalPages > 1}
			<div class={`gridlite-pagination ${classNames.pagination ?? ''}`}>
				<span>
					Page {page + 1} of {totalPages} ({totalRows} rows)
				</span>
				<div>
					<button disabled={page === 0} on:click={() => setPage(0)}>
						First
					</button>
					<button disabled={page === 0} on:click={() => setPage(page - 1)}>
						Prev
					</button>
					<button disabled={page >= totalPages - 1} on:click={() => setPage(page + 1)}>
						Next
					</button>
					<button disabled={page >= totalPages - 1} on:click={() => setPage(totalPages - 1)}>
						Last
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>
