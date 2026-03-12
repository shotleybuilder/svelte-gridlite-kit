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
	import SortBar from './components/SortBar.svelte';
	import GroupBar from './components/GroupBar.svelte';
	import CellContextMenu from './components/CellContextMenu.svelte';
	import ColumnMenu from './components/ColumnMenu.svelte';
	import RowDetailModal from './components/RowDetailModal.svelte';

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
	let globalFilter = '';
	let page = 0;
	let pageSize = config?.pagination?.pageSize ?? 25;
	let totalRows = 0;
	let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

	// Toolbar UI state
	let filterExpanded = false;
	let sortExpanded = false;
	let groupExpanded = false;

	// Context menu state
	let contextMenu: {
		x: number;
		y: number;
		value: unknown;
		columnName: string;
		columnLabel: string;
		isNumeric: boolean;
	} | null = null;

	// Column menu state
	let columnMenuOpen: string | null = null;

	// View controls UI state
	let showRowHeightMenu = false;
	let showColumnSpacingMenu = false;
	let showColumnPicker = false;

	const rowHeightOptions: RowHeight[] = ['short', 'medium', 'tall', 'extra_tall'];
	const columnSpacingOptions: ColumnSpacing[] = ['narrow', 'normal', 'wide'];

	// Column visibility state
	let columnVisibility: Record<string, boolean> = {};

	// Row detail state
	let rowDetailOpen = false;
	let rowDetailIndex = -1;

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

	// Visible columns (respecting config + columnVisibility toggle state)
	$: visibleColumns = columns.filter((col) => {
		// If columnVisibility has an explicit entry, use it
		if (col.name in columnVisibility) {
			return columnVisibility[col.name];
		}
		// Otherwise fall back to config defaults
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
				allowedColumns,
				globalSearch: globalFilter || undefined
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
				allowedColumns,
				globalSearch: globalFilter || undefined
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

	export function setGlobalFilter(search: string) {
		globalFilter = search;
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
				globalFilter,
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

	// ─── SortBar handlers ─────────────────────────────────────────────────────

	function handleSortingChange(newSorting: SortConfig[]) {
		setSorting(newSorting);
	}

	// ─── GroupBar handlers ────────────────────────────────────────────────────

	function handleGroupingChange(newGrouping: GroupConfig[]) {
		setGrouping(newGrouping);
	}

	// ─── Global Search handler ────────────────────────────────────────────────

	function handleGlobalSearchInput(event: Event) {
		const value = (event.target as HTMLInputElement).value;
		globalFilter = value;
		clearTimeout(searchDebounceTimer);
		searchDebounceTimer = setTimeout(() => {
			page = 0;
			rebuildQuery();
			notifyStateChange();
		}, 300);
	}

	function clearGlobalSearch() {
		globalFilter = '';
		clearTimeout(searchDebounceTimer);
		page = 0;
		rebuildQuery();
		notifyStateChange();
	}

	// ─── CellContextMenu handlers ─────────────────────────────────────────────

	function handleCellContextMenu(
		event: MouseEvent,
		row: Record<string, unknown>,
		col: ColumnMetadata
	) {
		event.preventDefault();
		const colConfig = config?.columns?.find((c) => c.name === col.name);
		contextMenu = {
			x: event.clientX,
			y: event.clientY,
			value: row[col.name],
			columnName: col.name,
			columnLabel: colConfig?.label ?? col.name,
			isNumeric: col.dataType === 'number'
		};
	}

	function handleContextFilterEquals(columnName: string, value: unknown) {
		const id = `ctx-${Date.now()}`;
		const newFilter: FilterCondition = { id, field: columnName, operator: 'equals', value };
		setFilters([...filters, newFilter], filterLogic);
		filterExpanded = true;
	}

	function handleContextFilterNotEquals(columnName: string, value: unknown) {
		const id = `ctx-${Date.now()}`;
		const newFilter: FilterCondition = { id, field: columnName, operator: 'not_equals', value };
		setFilters([...filters, newFilter], filterLogic);
		filterExpanded = true;
	}

	function handleContextFilterGreaterThan(columnName: string, value: unknown) {
		const id = `ctx-${Date.now()}`;
		const newFilter: FilterCondition = { id, field: columnName, operator: 'greater_than', value };
		setFilters([...filters, newFilter], filterLogic);
		filterExpanded = true;
	}

	function handleContextFilterLessThan(columnName: string, value: unknown) {
		const id = `ctx-${Date.now()}`;
		const newFilter: FilterCondition = { id, field: columnName, operator: 'less_than', value };
		setFilters([...filters, newFilter], filterLogic);
		filterExpanded = true;
	}

	// ─── ColumnMenu handlers ──────────────────────────────────────────────────

	function handleColumnMenuSort(columnName: string, direction: 'asc' | 'desc') {
		// Replace or add sort for this column
		const existing = sorting.findIndex((s) => s.column === columnName);
		const newSorting = [...sorting];
		if (existing >= 0) {
			newSorting[existing] = { column: columnName, direction };
		} else {
			newSorting.push({ column: columnName, direction });
		}
		setSorting(newSorting);
	}

	function handleColumnMenuFilter(columnName: string) {
		// Open filter bar with a new empty filter for this column
		const id = `colmenu-${Date.now()}`;
		const newFilter: FilterCondition = { id, field: columnName, operator: 'contains', value: '' };
		setFilters([...filters, newFilter], filterLogic);
		filterExpanded = true;
	}

	function handleColumnMenuGroup(columnName: string) {
		// Add grouping for this column if not already grouped
		if (!grouping.some((g) => g.column === columnName)) {
			setGrouping([...grouping, { column: columnName }]);
			groupExpanded = true;
		}
	}

	function handleColumnMenuHide(columnName: string) {
		toggleColumnVisibility(columnName);
	}

	// ─── View Controls handlers ───────────────────────────────────────────────

	function toggleColumnVisibility(columnName: string) {
		const current = columnVisibility[columnName] ?? true;
		columnVisibility = { ...columnVisibility, [columnName]: !current };
		notifyStateChange();
	}

	function toggleAllColumns(show: boolean) {
		const newVisibility: Record<string, boolean> = {};
		for (const col of columns) {
			newVisibility[col.name] = show;
		}
		columnVisibility = newVisibility;
		notifyStateChange();
	}

	function getColumnLabel(col: ColumnMetadata): string {
		const cfg = config?.columns?.find((c) => c.name === col.name);
		return cfg?.label ?? col.name;
	}

	function isColumnVisible(columnName: string): boolean {
		if (columnName in columnVisibility) {
			return columnVisibility[columnName];
		}
		if (config?.defaultVisibleColumns) {
			return config.defaultVisibleColumns.includes(columnName);
		}
		return true;
	}

	function closeViewMenus(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.gridlite-view-control')) {
			showRowHeightMenu = false;
			showColumnSpacingMenu = false;
			showColumnPicker = false;
		}
	}

	// ─── RowDetail handlers ───────────────────────────────────────────────────

	function openRowDetail(index: number) {
		rowDetailIndex = index;
		rowDetailOpen = true;
	}

	function closeRowDetail() {
		rowDetailOpen = false;
		rowDetailIndex = -1;
	}

	function prevRowDetail() {
		if (rowDetailIndex > 0) {
			rowDetailIndex--;
		}
	}

	function nextRowDetail() {
		if (rowDetailIndex < storeState.rows.length - 1) {
			rowDetailIndex++;
		}
	}

	$: rowDetailRow = rowDetailIndex >= 0 ? storeState.rows[rowDetailIndex] ?? null : null;

	// ─── Lifecycle ────────────────────────────────────────────────────────────

	onMount(() => {
		init();
	});

	onDestroy(() => {
		clearTimeout(searchDebounceTimer);
		if (store) {
			store.destroy();
		}
	});
</script>

<svelte:window on:click={closeViewMenus} />

<div class={containerClass}>
	{#if error}
		<div class="gridlite-empty">{error}</div>
	{:else if !initialized || storeState.loading}
		<div class="gridlite-loading">Loading...</div>
	{:else if storeState.error}
		<div class="gridlite-empty">Error: {storeState.error.message}</div>
	{:else}
		{#if table}
			<div class="gridlite-toolbar">
				{#if features.filtering}
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
				{/if}
				{#if features.sorting}
					<SortBar
						{columns}
						columnConfigs={config?.columns ?? []}
						{sorting}
						onSortingChange={handleSortingChange}
						isExpanded={sortExpanded}
						onExpandedChange={(expanded) => (sortExpanded = expanded)}
					/>
				{/if}
				{#if features.grouping}
					<GroupBar
						{columns}
						columnConfigs={config?.columns ?? []}
						{grouping}
						onGroupingChange={handleGroupingChange}
						isExpanded={groupExpanded}
						onExpandedChange={(expanded) => (groupExpanded = expanded)}
					/>
				{/if}
				{#if features.globalSearch}
					<div class="gridlite-search">
						<svg class="gridlite-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<input
							class="gridlite-search-input"
							type="text"
							placeholder="Search all columns..."
							value={globalFilter}
							on:input={handleGlobalSearchInput}
						/>
						{#if globalFilter}
							<button class="gridlite-search-clear" on:click={clearGlobalSearch} type="button" title="Clear search">
								<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>
				{/if}

				<!-- View Controls -->
				<div class="gridlite-view-controls">
					<!-- Row Height -->
					<div class="gridlite-view-control">
						<button
							class="gridlite-view-control-btn"
							class:active={showRowHeightMenu}
							on:click|stopPropagation={() => {
								showRowHeightMenu = !showRowHeightMenu;
								showColumnSpacingMenu = false;
								showColumnPicker = false;
							}}
							type="button"
							title="Row height"
						>
							<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
							</svg>
						</button>
						{#if showRowHeightMenu}
							<div class="gridlite-view-dropdown">
								<div class="gridlite-view-dropdown-title">Row Height</div>
								{#each rowHeightOptions as rh}
									<button
										class="gridlite-view-dropdown-item"
										class:selected={rowHeight === rh}
										on:click={() => {
											rowHeight = rh;
											showRowHeightMenu = false;
										}}
										type="button"
									>
										{rh === 'extra_tall' ? 'Extra Tall' : rh.charAt(0).toUpperCase() + rh.slice(1)}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Column Spacing -->
					<div class="gridlite-view-control">
						<button
							class="gridlite-view-control-btn"
							class:active={showColumnSpacingMenu}
							on:click|stopPropagation={() => {
								showColumnSpacingMenu = !showColumnSpacingMenu;
								showRowHeightMenu = false;
								showColumnPicker = false;
							}}
							type="button"
							title="Column spacing"
						>
							<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4v16M15 4v16M4 9h16M4 15h16" />
							</svg>
						</button>
						{#if showColumnSpacingMenu}
							<div class="gridlite-view-dropdown">
								<div class="gridlite-view-dropdown-title">Column Spacing</div>
								{#each columnSpacingOptions as sp}
									<button
										class="gridlite-view-dropdown-item"
										class:selected={columnSpacing === sp}
										on:click={() => {
											columnSpacing = sp;
											showColumnSpacingMenu = false;
										}}
										type="button"
									>
										{sp.charAt(0).toUpperCase() + sp.slice(1)}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Column Visibility -->
					{#if features.columnVisibility}
						<div class="gridlite-view-control">
							<button
								class="gridlite-view-control-btn"
								class:active={showColumnPicker}
								on:click|stopPropagation={() => {
									showColumnPicker = !showColumnPicker;
									showRowHeightMenu = false;
									showColumnSpacingMenu = false;
								}}
								type="button"
								title="Columns"
							>
								<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
								</svg>
								Columns
							</button>
							{#if showColumnPicker}
								<div class="gridlite-view-dropdown gridlite-column-picker">
									<div class="gridlite-view-dropdown-title">Columns</div>
									<div class="gridlite-column-picker-actions">
										<button type="button" on:click={() => toggleAllColumns(true)}>Show All</button>
										<button type="button" on:click={() => toggleAllColumns(false)}>Hide All</button>
									</div>
									<div class="gridlite-column-picker-list">
										{#each columns as col}
											<label class="gridlite-column-picker-item">
												<input
													type="checkbox"
													checked={isColumnVisible(col.name)}
													on:change={() => toggleColumnVisibility(col.name)}
												/>
												{getColumnLabel(col)}
											</label>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<table class={`gridlite-table ${classNames.table ?? ''}`}>
			<thead class={`gridlite-thead ${classNames.thead ?? ''}`}>
				<tr class={classNames.tr ?? ''}>
					{#each orderedColumns as col}
						<th class={`gridlite-th gridlite-th-interactive ${classNames.th ?? ''}`}>
							<div class="gridlite-th-content">
								<span class="gridlite-th-label">
									{#if config?.columns}
										{@const colConfig = config.columns.find((c) => c.name === col.name)}
										{colConfig?.label ?? col.name}
									{:else}
										{col.name}
									{/if}
								</span>
								{#if table}
									<button
										class="gridlite-th-menu-btn"
										on:click|stopPropagation={() =>
											(columnMenuOpen = columnMenuOpen === col.name ? null : col.name)}
										title="Column options"
										type="button"
									>
										<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</button>
									<ColumnMenu
										columnName={col.name}
										isOpen={columnMenuOpen === col.name}
										{sorting}
										canSort={features.sorting ?? false}
										canFilter={features.filtering ?? false}
										canGroup={features.grouping ?? false}
										onSort={handleColumnMenuSort}
										onFilter={handleColumnMenuFilter}
										onGroup={handleColumnMenuGroup}
										onHide={handleColumnMenuHide}
										onClose={() => (columnMenuOpen = null)}
									/>
								{/if}
							</div>
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
					{#each storeState.rows as row, rowIndex}
						<tr
							class={`gridlite-tr ${classNames.tr ?? ''}`}
							on:click={() => {
								if (features.rowDetail) {
									openRowDetail(rowIndex);
								}
								onRowClick?.(row);
							}}
							role={onRowClick || features.rowDetail ? 'button' : undefined}
							tabindex={onRowClick || features.rowDetail ? 0 : undefined}
							on:keydown={(e) => {
								if ((e.key === 'Enter' || e.key === ' ')) {
									e.preventDefault();
									if (features.rowDetail) openRowDetail(rowIndex);
									onRowClick?.(row);
								}
							}}
						>
							{#each orderedColumns as col}
								<td
									class={`gridlite-td ${classNames.td ?? ''}`}
									on:contextmenu={(e) => handleCellContextMenu(e, row, col)}
								>
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

		{#if features.pagination !== false && totalRows > 0}
			<div class={`gridlite-pagination ${classNames.pagination ?? ''}`}>
				<span>
					Page {page + 1} of {totalPages} ({totalRows} rows)
				</span>
				<div class="gridlite-pagination-controls">
					<select
						class="gridlite-page-size-select"
						value={pageSize}
						on:change={(e) => setPageSize(Number(e.currentTarget.value))}
					>
						{#each config?.pagination?.pageSizeOptions ?? [10, 25, 50, 100] as size}
							<option value={size}>{size} / page</option>
						{/each}
					</select>
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

		{#if contextMenu}
			<CellContextMenu
				x={contextMenu.x}
				y={contextMenu.y}
				value={contextMenu.value}
				columnName={contextMenu.columnName}
				columnLabel={contextMenu.columnLabel}
				isNumeric={contextMenu.isNumeric}
				onFilterEquals={handleContextFilterEquals}
				onFilterNotEquals={handleContextFilterNotEquals}
				onFilterGreaterThan={handleContextFilterGreaterThan}
				onFilterLessThan={handleContextFilterLessThan}
				onClose={() => (contextMenu = null)}
			/>
		{/if}

		{#if features.rowDetail}
			<RowDetailModal
				isOpen={rowDetailOpen}
				hasPrev={rowDetailIndex > 0}
				hasNext={rowDetailIndex < storeState.rows.length - 1}
				onClose={closeRowDetail}
				onPrev={prevRowDetail}
				onNext={nextRowDetail}
			>
				{#if rowDetailRow}
					<dl class="gridlite-row-detail">
						{#each orderedColumns as col}
							<div class="gridlite-row-detail-field">
								<dt>
									{#if config?.columns}
										{@const colConfig = config.columns.find((c) => c.name === col.name)}
										{colConfig?.label ?? col.name}
									{:else}
										{col.name}
									{/if}
								</dt>
								<dd>
									{#if config?.columns}
										{@const colConfig = config.columns.find((c) => c.name === col.name)}
										{#if colConfig?.format}
											{colConfig.format(rowDetailRow[col.name])}
										{:else}
											{rowDetailRow[col.name] ?? '—'}
										{/if}
									{:else}
										{rowDetailRow[col.name] ?? '—'}
									{/if}
								</dd>
							</div>
						{/each}
					</dl>
				{/if}
			</RowDetailModal>
		{/if}
	{/if}
</div>
