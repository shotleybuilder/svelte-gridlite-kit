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
		ColumnSpacing,
		ToolbarLayout
	} from './types.js';
	import { introspectTable, getColumnNames, mapOidToDataType } from './query/schema.js';
	import {
		buildQuery,
		buildCountQuery,
		buildGroupSummaryQuery,
		buildGroupCountQuery,
		buildGroupDetailQuery
	} from './query/builder.js';
	import {
		createLiveQueryStore,
		type PGliteWithLive,
		type LiveQueryStore,
		type LiveQueryState
	} from './query/live.js';
	import { runMigrations } from './state/migrations.js';
	import { loadColumnState, saveColumnState } from './state/views.js';
	import FilterBar from './components/FilterBar.svelte';
	import SortBar from './components/SortBar.svelte';
	import GroupBar from './components/GroupBar.svelte';
	import CellContextMenu from './components/CellContextMenu.svelte';
	import ColumnMenu from './components/ColumnMenu.svelte';
	import ColumnPicker from './components/ColumnPicker.svelte';
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

	/** Toolbar layout preset */
	export let toolbarLayout: ToolbarLayout = 'airtable';

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

	// Column order state
	let columnOrder: string[] = config?.defaultColumnOrder ?? [];
	let draggedColumnId: string | null = null;
	let dragOverColumnId: string | null = null;

	// Column sizing state
	let columnSizing: Record<string, number> = config?.defaultColumnSizing ?? {};
	let resizingColumn: string | null = null;
	let resizeStartX = 0;
	let resizeStartWidth = 0;

	const COL_MIN_WIDTH = 62;
	const COL_MAX_WIDTH = 1000;
	const COL_DEFAULT_WIDTH = 180;

	// Custom labels state (user-editable, persisted)
	let customLabels: Record<string, string> = {};
	let editingColumnLabel: string | null = null;
	let editingLabelValue = '';

	// Grouped view state
	interface GroupRow {
		/** The group column values at this level (e.g. { department: 'Engineering' }) */
		values: Record<string, unknown>;
		/** Summary values from GROUP BY (includes _count and any aggregations) */
		summary: Record<string, unknown>;
		/** Number of rows in this group */
		count: number;
		/** Nesting depth: 0 = top-level group, 1 = sub-group, 2 = sub-sub-group */
		depth: number;
		/** Sub-groups (when there are deeper group levels to show) */
		subGroups: GroupRow[] | null;
		/** Detail rows (only at the deepest group level) */
		children: Record<string, unknown>[] | null;
	}
	let groupData: GroupRow[] = [];
	let expandedGroups: Set<string> = new Set();
	let totalGroups = 0;
	let groupLoading: Set<string> = new Set();

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
		`gridlite-layout-${toolbarLayout}`,
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

	// Ordered columns (columnOrder state takes priority, then config default, then schema order)
	$: orderedColumns = (() => {
		const order = columnOrder.length > 0 ? columnOrder : (config?.defaultColumnOrder ?? []);
		if (order.length > 0) {
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

	// Valid groups (only entries where the user has selected a column)
	$: validGrouping = grouping.filter((g) => g.column !== '');

	// Whether grouping is active
	$: isGrouped = validGrouping.length > 0;

	// Columns to show in headers and child rows when grouping — excludes grouped columns
	$: nonGroupedColumns = isGrouped
		? orderedColumns.filter((col) => !validGrouping.some((g) => g.column === col.name))
		: orderedColumns;

	// Merge custom labels into columnConfigs for sub-components
	$: mergedColumnConfigs = (() => {
		const base = config?.columns ?? [];
		if (Object.keys(customLabels).length === 0) return base;
		// Build a map of existing configs
		const configMap = new Map(base.map((c) => [c.name, c]));
		// Merge custom labels: override existing or add new entries
		for (const [name, label] of Object.entries(customLabels)) {
			const existing = configMap.get(name);
			if (existing) {
				configMap.set(name, { ...existing, label });
			} else {
				configMap.set(name, { name, label });
			}
		}
		return [...configMap.values()];
	})();

	/** Build a composite key for a group row (using values up to its depth) */
	function groupKey(group: GroupRow): string {
		return Object.entries(group.values)
			.map(([col, val]) => `${col}=${val === null || val === undefined ? '__null__' : String(val)}`)
			.join('::');
	}

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

			// Load persisted custom labels
			if (config?.id) {
				const savedState = await loadColumnState(db, config.id);
				const labels: Record<string, string> = {};
				for (const col of savedState) {
					if (col.label) labels[col.name] = col.label;
				}
				if (Object.keys(labels).length > 0) customLabels = labels;
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
			if (isGrouped) {
				// Grouped mode — use two-query strategy
				await rebuildGroupedQuery();
				return;
			}

			// Table mode — build query from state
			const usePagination = features.pagination !== false;
			const built = buildQuery({
				table,
				filters,
				filterLogic,
				sorting,
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

		// Clear grouped state when not grouping
		groupData = [];
		expandedGroups = new Set();
		totalGroups = 0;

		// Create live query store
		store = createLiveQueryStore(db, sql, params);
		store.subscribe((state) => {
			storeState = state;

			// In raw query mode, derive columns from result fields on first result
			if (query && columns.length === 0 && state.fields.length > 0) {
				columns = state.fields.map((f) => ({
					name: f.name,
					dataType: mapOidToDataType(f.dataTypeID),
					postgresType: 'unknown',
					nullable: true,
					hasDefault: false
				}));
				allowedColumns = columns.map((c) => c.name);
			}
		});
	}

	/** Clean aggregations (remove entries with empty column names) */
	function cleanAgg(g: GroupConfig): GroupConfig {
		return {
			...g,
			aggregations: g.aggregations?.filter((a) => a.column !== '') ?? undefined
		};
	}

	async function rebuildGroupedQuery() {
		if (!table) return;

		try {
			const usePagination = features.pagination !== false;

			// Top-level: group by first column only
			const topGroupConfig = cleanAgg(validGrouping[0]);

			// 1. Fetch top-level group summaries
			const summaryQuery = buildGroupSummaryQuery({
				table,
				grouping: [topGroupConfig],
				filters,
				filterLogic,
				allowedColumns,
				globalSearch: globalFilter || undefined,
				sorting,
				page: usePagination ? page : undefined,
				pageSize: usePagination ? pageSize : undefined
			});

			const summaryResult = await db.query<Record<string, unknown>>(
				summaryQuery.sql,
				summaryQuery.params as any[]
			);

			// 2. Get total group count for pagination
			if (usePagination) {
				const countQuery = buildGroupCountQuery({
					table,
					grouping: [topGroupConfig],
					filters,
					filterLogic,
					allowedColumns,
					globalSearch: globalFilter || undefined
				});
				const countResult = await db.query<{ total: string }>(
					countQuery.sql,
					countQuery.params as any[]
				);
				totalGroups = parseInt(countResult.rows[0]?.total ?? '0', 10);
				totalRows = totalGroups;
			}

			// 3. Build GroupRow[] from summary results
			const topCol = validGrouping[0].column;
			const newGroupData: GroupRow[] = summaryResult.rows.map((row) => {
				const values: Record<string, unknown> = { [topCol]: row[topCol] };
				const newGroup: GroupRow = {
					values,
					summary: { ...row },
					count: Number(row._count ?? 0),
					depth: 0,
					subGroups: null,
					children: null
				};
				const key = groupKey(newGroup);
				const wasExpanded = expandedGroups.has(key);
				const existing = groupData.find((g) => groupKey(g) === key);
				if (wasExpanded && existing) {
					newGroup.subGroups = existing.subGroups;
					newGroup.children = existing.children;
				}
				return newGroup;
			});

			groupData = newGroupData;

			// 4. Re-fetch sub-groups/children for any groups that were expanded
			for (const group of groupData) {
				const key = groupKey(group);
				if (expandedGroups.has(key) && group.subGroups === null && group.children === null) {
					await fetchGroupChildren(group);
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	/**
	 * Fetch children for an expanded group.
	 * If there are deeper group levels, fetches sub-group summaries.
	 * If this is the deepest level, fetches detail rows.
	 */
	async function fetchGroupChildren(group: GroupRow) {
		if (!table) return;

		const key = groupKey(group);
		groupLoading = new Set([...groupLoading, key]);

		try {
			const nextDepth = group.depth + 1;
			const parentValues = Object.entries(group.values).map(([column, value]) => ({
				column,
				value
			}));

			if (nextDepth < validGrouping.length) {
				// There are deeper group levels — fetch sub-group summaries
				const subGroupConfig = cleanAgg(validGrouping[nextDepth]);

				const summaryQuery = buildGroupSummaryQuery({
					table,
					grouping: [subGroupConfig],
					filters: [
						...filters,
						// Add parent group constraints as equals filters
						...parentValues.map((pv) => ({
							id: `_group_${pv.column}`,
							field: pv.column,
							operator: pv.value === null ? 'is_empty' as const : 'equals' as const,
							value: pv.value
						}))
					],
					filterLogic,
					allowedColumns,
					globalSearch: globalFilter || undefined,
					sorting
				});

				const result = await db.query<Record<string, unknown>>(
					summaryQuery.sql,
					summaryQuery.params as any[]
				);

				const subCol = validGrouping[nextDepth].column;
				const subGroups: GroupRow[] = result.rows.map((row) => {
					const subValues: Record<string, unknown> = {
						...group.values,
						[subCol]: row[subCol]
					};
					return {
						values: subValues,
						summary: { ...row },
						count: Number(row._count ?? 0),
						depth: nextDepth,
						subGroups: null,
						children: null
					};
				});

				updateGroupInTree(key, { subGroups });
			} else {
				// Deepest level — fetch detail rows
				const detailQuery = buildGroupDetailQuery({
					table,
					groupValues: parentValues,
					filters,
					filterLogic,
					sorting,
					allowedColumns,
					globalSearch: globalFilter || undefined
				});

				const result = await db.query<Record<string, unknown>>(
					detailQuery.sql,
					detailQuery.params as any[]
				);

				updateGroupInTree(key, { children: result.rows });
			}
		} catch (err) {
			console.error('Failed to fetch group children:', err);
		} finally {
			const next = new Set(groupLoading);
			next.delete(key);
			groupLoading = next;
		}
	}

	/** Update a group node in the tree by key */
	function updateGroupInTree(targetKey: string, updates: Partial<GroupRow>) {
		groupData = groupData.map((g) => updateGroupNode(g, targetKey, updates));
	}

	function updateGroupNode(node: GroupRow, targetKey: string, updates: Partial<GroupRow>): GroupRow {
		if (groupKey(node) === targetKey) {
			return { ...node, ...updates };
		}
		if (node.subGroups) {
			return {
				...node,
				subGroups: node.subGroups.map((sg) => updateGroupNode(sg, targetKey, updates))
			};
		}
		return node;
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
		const prevValid = grouping.filter((g) => g.column !== '');
		grouping = newGrouping;
		const nowValid = newGrouping.filter((g) => g.column !== '');

		// Only reset expand state and page if the valid group columns actually changed
		const changed = prevValid.length !== nowValid.length ||
			prevValid.some((g, i) => g.column !== nowValid[i]?.column);
		if (changed) {
			expandedGroups = new Set();
			groupData = [];
			page = 0;
		}

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
				columnOrder: columnOrder.length > 0 ? columnOrder : orderedColumns.map((c) => c.name),
				columnSizing,
				filters,
				filterLogic,
				sorting,
				grouping,
				globalFilter,
				pagination: { page, pageSize, totalRows, totalPages }
			});
		}
	}

	// ─── Grouped View handlers ────────────────────────────────────────────────

	async function toggleGroupExpand(group: GroupRow) {
		const key = groupKey(group);
		const next = new Set(expandedGroups);
		if (next.has(key)) {
			next.delete(key);
			expandedGroups = next;
			// Clear sub-groups and children
			updateGroupInTree(key, { subGroups: null, children: null });
		} else {
			next.add(key);
			expandedGroups = next;
			await fetchGroupChildren(group);
		}
	}

	function getGroupLabel(group: GroupRow): string {
		// Show only the value at this group's depth level
		const groupConfig = validGrouping[group.depth];
		if (!groupConfig) return '';
		const val = group.values[groupConfig.column];
		return val === null || val === undefined ? '(Empty)' : String(val);
	}

	function getGroupAggregations(group: GroupRow): { label: string; value: string }[] {
		const aggs: { label: string; value: string }[] = [];
		const groupConfig = validGrouping[group.depth];
		if (groupConfig?.aggregations) {
			for (const agg of groupConfig.aggregations) {
				if (agg.column === '') continue;
				const alias = agg.alias ?? `${agg.function}_${agg.column}`;
				const rawVal = group.summary[alias];
				if (rawVal !== null && rawVal !== undefined) {
					const label = `${agg.function.charAt(0).toUpperCase() + agg.function.slice(1)} ${agg.column}`;
					const value = typeof rawVal === 'number' ? rawVal.toLocaleString() : String(rawVal);
					aggs.push({ label, value });
				}
			}
		}
		return aggs;
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
		contextMenu = {
			x: event.clientX,
			y: event.clientY,
			value: row[col.name],
			columnName: col.name,
			columnLabel: getColumnLabel(col),
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
		const current = isColumnVisible(columnName);
		columnVisibility = { ...columnVisibility, [columnName]: !current };
		notifyStateChange();
	}

	function setColumnVisibility(columnName: string, visible: boolean) {
		columnVisibility = { ...columnVisibility, [columnName]: visible };
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

	function handleColumnOrderChange(newOrder: string[]) {
		columnOrder = newOrder;
		notifyStateChange();
	}

	function getColumnLabel(col: ColumnMetadata): string {
		if (col.name in customLabels) return customLabels[col.name];
		const cfg = config?.columns?.find((c) => c.name === col.name);
		return cfg?.label ?? col.name;
	}

	// ─── Column Label Editing ─────────────────────────────────────────────────

	function startEditingLabel(columnName: string) {
		const col = columns.find((c) => c.name === columnName);
		if (!col) return;
		editingColumnLabel = columnName;
		editingLabelValue = getColumnLabel(col);
	}

	function commitLabelEdit() {
		if (!editingColumnLabel) return;
		const columnName = editingColumnLabel;
		const newLabel = editingLabelValue.trim();

		// Resolve the default label (config or column name)
		const cfg = config?.columns?.find((c) => c.name === columnName);
		const defaultLabel = cfg?.label ?? columnName;

		if (newLabel && newLabel !== defaultLabel) {
			// Save custom label
			customLabels = { ...customLabels, [columnName]: newLabel };
		} else {
			// Reverted to default — remove custom label
			const { [columnName]: _, ...rest } = customLabels;
			customLabels = rest;
		}

		editingColumnLabel = null;
		editingLabelValue = '';
		persistColumnLabels();
		notifyStateChange();
	}

	function cancelLabelEdit() {
		editingColumnLabel = null;
		editingLabelValue = '';
	}

	function handleLabelKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitLabelEdit();
		} else if (event.key === 'Escape') {
			cancelLabelEdit();
		}
	}

	async function persistColumnLabels() {
		if (!config?.id) return;
		try {
			const colState = columns.map((col, i) => ({
				name: col.name,
				visible: isColumnVisible(col.name),
				width: columnSizing[col.name] ?? undefined,
				position: columnOrder.indexOf(col.name) >= 0 ? columnOrder.indexOf(col.name) : i,
				label: customLabels[col.name] ?? null
			}));
			await saveColumnState(db, config.id, colState);
		} catch (err) {
			console.error('Failed to persist column labels:', err);
		}
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

	// ─── Column Resize handlers ───────────────────────────────────────────────

	function getColumnWidth(columnName: string): number {
		if (columnName in columnSizing) return columnSizing[columnName];
		const colConfig = config?.columns?.find((c) => c.name === columnName);
		return colConfig?.width ?? COL_DEFAULT_WIDTH;
	}

	function handleResizeStart(event: MouseEvent | TouchEvent, columnName: string) {
		event.preventDefault();
		event.stopPropagation();
		resizingColumn = columnName;
		resizeStartX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		resizeStartWidth = getColumnWidth(columnName);
		window.addEventListener('mousemove', handleResizeMove);
		window.addEventListener('mouseup', handleResizeEnd);
		window.addEventListener('touchmove', handleResizeMove);
		window.addEventListener('touchend', handleResizeEnd);
	}

	function handleResizeMove(event: MouseEvent | TouchEvent) {
		if (!resizingColumn) return;
		const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		const delta = clientX - resizeStartX;
		const newWidth = Math.max(COL_MIN_WIDTH, Math.min(COL_MAX_WIDTH, resizeStartWidth + delta));
		columnSizing = { ...columnSizing, [resizingColumn]: newWidth };
	}

	function handleResizeEnd() {
		resizingColumn = null;
		window.removeEventListener('mousemove', handleResizeMove);
		window.removeEventListener('mouseup', handleResizeEnd);
		window.removeEventListener('touchmove', handleResizeMove);
		window.removeEventListener('touchend', handleResizeEnd);
		notifyStateChange();
	}

	// ─── Column Reorder handlers ──────────────────────────────────────────────

	function initColumnOrder() {
		if (columnOrder.length === 0 && columns.length > 0) {
			columnOrder = columns.map((c) => c.name);
		}
	}

	function handleDragStart(event: DragEvent, columnName: string) {
		if (features.columnReordering === false) return;
		draggedColumnId = columnName;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', columnName);
		}
	}

	function handleDragOver(event: DragEvent, columnName: string) {
		if (features.columnReordering === false || !draggedColumnId) return;
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		dragOverColumnId = columnName;
	}

	function handleDrop(event: DragEvent, targetColumnId: string) {
		if (features.columnReordering === false) return;
		event.preventDefault();
		if (!draggedColumnId || draggedColumnId === targetColumnId) {
			draggedColumnId = null;
			dragOverColumnId = null;
			return;
		}

		// Ensure columnOrder is initialized
		initColumnOrder();

		const oldIndex = columnOrder.indexOf(draggedColumnId);
		const newIndex = columnOrder.indexOf(targetColumnId);

		if (oldIndex !== -1 && newIndex !== -1) {
			const newColumnOrder = [...columnOrder];
			const [moved] = newColumnOrder.splice(oldIndex, 1);
			newColumnOrder.splice(newIndex, 0, moved);
			columnOrder = newColumnOrder;
			notifyStateChange();
		}

		draggedColumnId = null;
		dragOverColumnId = null;
	}

	function handleDragEnd() {
		draggedColumnId = null;
		dragOverColumnId = null;
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

	// Flatten the group tree into a renderable list of items
	interface FlatGroupItem {
		type: 'group';
		group: GroupRow;
	}
	interface FlatChildItem {
		type: 'child';
		row: Record<string, unknown>;
		depth: number;
	}
	type FlatItem = FlatGroupItem | FlatChildItem;

	function flattenGroupTree(groups: GroupRow[]): FlatItem[] {
		const items: FlatItem[] = [];
		for (const group of groups) {
			items.push({ type: 'group', group });
			const key = groupKey(group);
			if (expandedGroups.has(key)) {
				if (group.subGroups) {
					items.push(...flattenGroupTree(group.subGroups));
				}
				if (group.children) {
					for (const row of group.children) {
						items.push({ type: 'child', row, depth: group.depth + 1 });
					}
				}
			}
		}
		return items;
	}

	$: flatGroupItems = isGrouped ? flattenGroupTree(groupData) : [];

	// ─── Lifecycle ────────────────────────────────────────────────────────────

	onMount(() => {
		init();
	});

	onDestroy(() => {
		clearTimeout(searchDebounceTimer);
		if (resizingColumn) {
			handleResizeEnd();
		}
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
		{#if table && toolbarLayout !== 'aggrid'}
			<div class="gridlite-toolbar">
				<!-- Custom toolbar content (start) -->
				<slot name="toolbar-start" />

				<!-- Column Visibility (data control) -->
				{#if features.columnVisibility}
					<div class="gridlite-toolbar-columns gridlite-view-control">
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
							<span class="gridlite-btn-label">Columns</span>
						</button>
						<ColumnPicker
							{columns}
							columnConfigs={mergedColumnConfigs}
							{columnVisibility}
							{columnOrder}
							isOpen={showColumnPicker}
							defaultVisibleColumns={config?.defaultVisibleColumns}
							onVisibilityChange={setColumnVisibility}
							onToggleAll={toggleAllColumns}
							onOrderChange={handleColumnOrderChange}
						/>
					</div>
				{/if}

				<!-- Filter -->
				{#if features.filtering}
					<div class="gridlite-toolbar-filter">
						<FilterBar
							{db}
							{table}
							{columns}
							columnConfigs={mergedColumnConfigs}
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

				<!-- Group -->
				{#if features.grouping}
					<div class="gridlite-toolbar-group">
						<GroupBar
							{columns}
							columnConfigs={mergedColumnConfigs}
							{grouping}
							onGroupingChange={handleGroupingChange}
							isExpanded={groupExpanded}
							onExpandedChange={(expanded) => (groupExpanded = expanded)}
						/>
					</div>
				{/if}

				<!-- Sort -->
				{#if features.sorting}
					<div class="gridlite-toolbar-sort">
						<SortBar
							{columns}
							columnConfigs={mergedColumnConfigs}
							{sorting}
							onSortingChange={handleSortingChange}
							isExpanded={sortExpanded}
							onExpandedChange={(expanded) => (sortExpanded = expanded)}
						/>
					</div>
				{/if}

				<!-- View Controls (Row Height + Column Spacing) -->
				<div class="gridlite-toolbar-view gridlite-view-controls">
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
				</div>

				<!-- Search -->
				{#if features.globalSearch}
					<div class="gridlite-toolbar-search">
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
					</div>
				{/if}

				<!-- Custom toolbar content (end) -->
				<slot name="toolbar-end" />
			</div>
		{/if}

		{#if table && toolbarLayout === 'aggrid'}
			<!-- AG Grid layout: sidebar on right, minimal toolbar on top -->
			<!-- TODO(#1): aggrid layout is experimental — not production-ready. Needs debugging. -->
			<div class="gridlite-toolbar gridlite-toolbar-aggrid-top">
				<!-- Custom toolbar content (start) -->
				<slot name="toolbar-start" />

				{#if features.globalSearch}
					<div class="gridlite-toolbar-search">
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
					</div>
				{/if}
				{#if features.sorting}
					<div class="gridlite-toolbar-sort">
						<SortBar
							{columns}
							columnConfigs={mergedColumnConfigs}
							{sorting}
							onSortingChange={handleSortingChange}
							isExpanded={sortExpanded}
							onExpandedChange={(expanded) => (sortExpanded = expanded)}
						/>
					</div>
				{/if}
				{#if features.grouping}
					<div class="gridlite-toolbar-group">
						<GroupBar
							{columns}
							columnConfigs={mergedColumnConfigs}
							{grouping}
							onGroupingChange={handleGroupingChange}
							isExpanded={groupExpanded}
							onExpandedChange={(expanded) => (groupExpanded = expanded)}
						/>
					</div>
				{/if}
				<div class="gridlite-toolbar-view gridlite-view-controls">
					<div class="gridlite-view-control">
						<button
							class="gridlite-view-control-btn"
							class:active={showRowHeightMenu}
							on:click|stopPropagation={() => {
								showRowHeightMenu = !showRowHeightMenu;
								showColumnSpacingMenu = false;
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
										on:click={() => { rowHeight = rh; showRowHeightMenu = false; }}
										type="button"
									>{rh === 'extra_tall' ? 'Extra Tall' : rh.charAt(0).toUpperCase() + rh.slice(1)}</button>
								{/each}
							</div>
						{/if}
					</div>
					<div class="gridlite-view-control">
						<button
							class="gridlite-view-control-btn"
							class:active={showColumnSpacingMenu}
							on:click|stopPropagation={() => {
								showColumnSpacingMenu = !showColumnSpacingMenu;
								showRowHeightMenu = false;
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
										on:click={() => { columnSpacing = sp; showColumnSpacingMenu = false; }}
										type="button"
									>{sp.charAt(0).toUpperCase() + sp.slice(1)}</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Custom toolbar content (end) -->
				<slot name="toolbar-end" />
			</div>
		{/if}

		<div class="gridlite-body" class:gridlite-aggrid-body={toolbarLayout === 'aggrid'}>
		<div class="gridlite-table-wrap">
		<table
			class={`gridlite-table ${classNames.table ?? ''}`}
			style={features.columnResizing ? 'table-layout: fixed;' : ''}
		>
			<thead class={`gridlite-thead ${classNames.thead ?? ''}`}>
				<tr class={classNames.tr ?? ''}>
					{#each (isGrouped ? nonGroupedColumns : orderedColumns) as col}
						<th
							class={`gridlite-th gridlite-th-interactive ${classNames.th ?? ''}`}
							class:dragging={draggedColumnId === col.name}
							class:drag-over={dragOverColumnId === col.name && draggedColumnId !== col.name}
							style={features.columnResizing ? `width: ${getColumnWidth(col.name)}px;` : ''}
							on:dragover={(e) => handleDragOver(e, col.name)}
							on:drop={(e) => handleDrop(e, col.name)}
						>
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div
								class="gridlite-th-content"
								draggable={features.columnReordering ?? false}
								on:dragstart={(e) => handleDragStart(e, col.name)}
								on:dragend={handleDragEnd}
								style={features.columnReordering ? 'cursor: grab;' : ''}
							>
								{#if editingColumnLabel === col.name}
									<!-- svelte-ignore a11y-autofocus -->
									<input
										class="gridlite-th-label-input"
										type="text"
										bind:value={editingLabelValue}
										on:blur={commitLabelEdit}
										on:keydown={handleLabelKeydown}
										on:click|stopPropagation
										autofocus
									/>
								{:else}
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<span
										class="gridlite-th-label"
										on:dblclick|stopPropagation={() => startEditingLabel(col.name)}
										title="Double-click to rename"
									>
										{getColumnLabel(col)}
									</span>
								{/if}
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
							{#if features.columnResizing}
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div
									class="gridlite-resize-handle"
									class:resizing={resizingColumn === col.name}
									on:mousedown={(e) => handleResizeStart(e, col.name)}
									on:touchstart={(e) => handleResizeStart(e, col.name)}
								/>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class={`gridlite-tbody ${classNames.tbody ?? ''}`}>
				{#if isGrouped}
					<!-- Grouped view: flattened tree of group headers and child rows -->
					{#if flatGroupItems.length === 0}
						<tr>
							<td colspan={nonGroupedColumns.length} class="gridlite-empty">
								No data
							</td>
						</tr>
					{:else}
						{#each flatGroupItems as item}
							{#if item.type === 'group'}
								{@const group = item.group}
								{@const key = groupKey(group)}
								{@const expanded = expandedGroups.has(key)}
								{@const loading = groupLoading.has(key)}
								{@const aggs = getGroupAggregations(group)}
								<!-- Group header row -->
								<tr
									class="gridlite-group-row"
									on:click={() => toggleGroupExpand(group)}
									role="button"
									tabindex={0}
									on:keydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											toggleGroupExpand(group);
										}
									}}
								>
									<td colspan={nonGroupedColumns.length} class="gridlite-group-td">
										<div class="gridlite-group-header gridlite-group-level-{Math.min(group.depth, 2)}">
											<svg
												class="gridlite-group-chevron"
												class:expanded
												width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"
											>
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
											</svg>
											<span class="gridlite-group-label">{getGroupLabel(group)}</span>
											<span class="gridlite-group-count">{group.count}</span>
											{#each aggs as agg}
												<span class="gridlite-group-agg" title={agg.label}>{agg.label}: {agg.value}</span>
											{/each}
											{#if loading}
												<span class="gridlite-group-loading">Loading...</span>
											{/if}
										</div>
									</td>
								</tr>
							{:else}
								{@const row = item.row}
								<!-- Child data row -->
								<tr
									class={`gridlite-tr gridlite-group-child ${classNames.tr ?? ''}`}
									on:click={() => {
										onRowClick?.(row);
									}}
									role={onRowClick ? 'button' : undefined}
									tabindex={onRowClick ? 0 : undefined}
									on:keydown={(e) => {
										if ((e.key === 'Enter' || e.key === ' ')) {
											e.preventDefault();
											onRowClick?.(row);
										}
									}}
								>
									{#each nonGroupedColumns as col}
										<td
											class={`gridlite-td ${classNames.td ?? ''}`}
											on:contextmenu={(e) => handleCellContextMenu(e, row, col)}
										>
											<slot name="cell" value={row[col.name]} {row} column={col.name}>
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
											</slot>
										</td>
									{/each}
								</tr>
							{/if}
						{/each}
					{/if}
				{:else}
					<!-- Flat (non-grouped) view -->
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
										<slot name="cell" value={row[col.name]} {row} column={col.name}>
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
										</slot>
									</td>
								{/each}
							</tr>
						{/each}
					{/if}
				{/if}
			</tbody>
		</table>
		</div>

		{#if features.pagination !== false && totalRows > 0}
			<div class={`gridlite-pagination ${classNames.pagination ?? ''}`}>
				<span>
					Page {page + 1} of {totalPages} ({totalRows} {isGrouped ? 'groups' : 'rows'})
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

		{#if toolbarLayout === 'aggrid'}
			<!-- AG Grid sidebar: columns + filters on right -->
			<!-- TODO(#1): aggrid sidebar is experimental — not production-ready. Needs debugging. -->
			<aside class="gridlite-aggrid-sidebar">
				{#if features.columnVisibility}
					<div class="gridlite-aggrid-sidebar-section">
						<div class="gridlite-aggrid-sidebar-header">Columns</div>
						<ColumnPicker
							{columns}
							columnConfigs={mergedColumnConfigs}
							{columnVisibility}
							{columnOrder}
							isOpen={true}
							defaultVisibleColumns={config?.defaultVisibleColumns}
							onVisibilityChange={setColumnVisibility}
							onToggleAll={toggleAllColumns}
							onOrderChange={handleColumnOrderChange}
						/>
					</div>
				{/if}
				{#if features.filtering}
					<div class="gridlite-aggrid-sidebar-section">
						<div class="gridlite-aggrid-sidebar-header">Filters</div>
						<FilterBar
							{db}
							table={table ?? ''}
							{columns}
							columnConfigs={mergedColumnConfigs}
							{allowedColumns}
							conditions={filters}
							onConditionsChange={handleFiltersChange}
							logic={filterLogic}
							onLogicChange={handleLogicChange}
							isExpanded={true}
							onExpandedChange={() => {}}
						/>
					</div>
				{/if}
			</aside>
		{/if}
		</div>

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
					{#if $$slots['row-detail']}
						<slot name="row-detail" row={rowDetailRow} close={closeRowDetail} />
					{:else}
						<dl class="gridlite-row-detail">
							{#each orderedColumns as col}
								<div class="gridlite-row-detail-field">
									<dt>{getColumnLabel(col)}</dt>
									<dd>
										{#if mergedColumnConfigs.length > 0}
											{@const colConfig = mergedColumnConfigs.find((c) => c.name === col.name)}
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
				{/if}
			</RowDetailModal>
		{/if}
	{/if}
</div>
