<script lang="ts">
	/**
	 * FilterGroup — Recursive component for nested filter groups.
	 *
	 * Renders a group of FilterNode children (conditions or sub-groups)
	 * with its own AND/OR logic toggle. Supports up to 3 levels of nesting.
	 */

	import type {
		FilterCondition,
		FilterNode,
		FilterGroup,
		FilterLogic,
		ColumnMetadata,
		ColumnConfig
	} from '../types.js';
	import { isFilterGroup } from '../types.js';
	import type { PGliteWithLive } from '../query/live.js';
	import FilterConditionComponent from './FilterCondition.svelte';
	import { quoteIdentifier, resolveFrom } from '../query/builder.js';

	/** The filter group data */
	export let group: FilterGroup;

	/** Nesting depth (0 = top-level inside FilterBar) */
	export let depth: number = 0;

	/** Max nesting depth */
	const MAX_DEPTH = 3;

	/** PGLite instance for value suggestion queries */
	export let db: PGliteWithLive;

	/** Table name (mutually exclusive with `source`) */
	export let table: string = '';

	/** Raw SQL subquery source (mutually exclusive with `table`) */
	export let source: string = '';

	/** Introspected column metadata */
	export let columns: ColumnMetadata[];

	/** Column config overrides */
	export let columnConfigs: ColumnConfig[] = [];

	/** Allowed column names */
	export let allowedColumns: string[] = [];

	/** Called when this group is updated */
	export let onUpdate: (updated: FilterGroup) => void;

	/** Called when this group should be removed */
	export let onRemove: () => void;

	// ─── Value suggestion caches (per leaf condition) ──────────────────────────

	let columnValuesCache: Map<string, string[]> = new Map();
	let numericRangeCache: Map<string, { min: number; max: number } | null> = new Map();
	let conditionValues: Map<string, string[]> = new Map();
	let conditionRanges: Map<string, { min: number; max: number } | null> = new Map();

	async function getColumnValues(columnName: string): Promise<string[]> {
		if (!columnName || (!table && !source)) return [];
		if (columnValuesCache.has(columnName)) return columnValuesCache.get(columnName)!;

		try {
			const fromClause = resolveFrom(table || undefined, source || undefined);
			const quotedCol = quoteIdentifier(columnName, allowedColumns);

			// For JSONB columns, extract individual keys instead of whole JSON objects
			const col = columns.find((c) => c.name === columnName);
			const cfg = columnConfigs.find((c) => c.name === columnName);
			const dataType = cfg?.dataType ?? col?.dataType;

			let sql: string;
			if (dataType === 'json') {
				sql = `SELECT DISTINCT jsonb_object_keys(${quotedCol}) AS val FROM ${fromClause} WHERE ${quotedCol} IS NOT NULL ORDER BY val LIMIT 200`;
			} else {
				sql = `SELECT DISTINCT ${quotedCol}::TEXT AS val FROM ${fromClause} WHERE ${quotedCol} IS NOT NULL ORDER BY val LIMIT 200`;
			}

			const result = await db.query<{ val: string }>(sql);
			const values = result.rows.map((r) => r.val);
			columnValuesCache.set(columnName, values);
			return values;
		} catch {
			columnValuesCache.set(columnName, []);
			return [];
		}
	}

	async function getNumericRange(columnName: string): Promise<{ min: number; max: number } | null> {
		if (!columnName || (!table && !source)) return null;
		if (numericRangeCache.has(columnName)) return numericRangeCache.get(columnName)!;

		const col = columns.find((c) => c.name === columnName);
		const cfg = columnConfigs.find((c) => c.name === columnName);
		const dataType = cfg?.dataType ?? col?.dataType;
		if (dataType !== 'number') {
			numericRangeCache.set(columnName, null);
			return null;
		}

		try {
			const fromClause = resolveFrom(table || undefined, source || undefined);
			const quotedCol = quoteIdentifier(columnName, allowedColumns);
			const sql = `SELECT MIN(${quotedCol})::NUMERIC AS min_val, MAX(${quotedCol})::NUMERIC AS max_val FROM ${fromClause}`;
			const result = await db.query<{ min_val: string; max_val: string }>(sql);
			const row = result.rows[0];
			if (row && row.min_val != null && row.max_val != null) {
				const range = { min: Number(row.min_val), max: Number(row.max_val) };
				numericRangeCache.set(columnName, range);
				return range;
			}
			numericRangeCache.set(columnName, null);
			return null;
		} catch {
			numericRangeCache.set(columnName, null);
			return null;
		}
	}

	let loadingConditions: Set<string> = new Set();

	async function loadSuggestionsForCondition(conditionId: string, field: string) {
		if (!field || loadingConditions.has(conditionId)) return;

		loadingConditions.add(conditionId);

		const values = await getColumnValues(field);
		conditionValues.set(conditionId, values);
		conditionValues = conditionValues;
		const range = await getNumericRange(field);
		conditionRanges.set(conditionId, range);
		conditionRanges = conditionRanges;

		loadingConditions.delete(conditionId);
	}

	// Load suggestions for leaf children
	$: {
		for (const child of group.children) {
			if (!isFilterGroup(child) && child.field) {
				if (!conditionValues.has(child.id)) {
					loadSuggestionsForCondition(child.id, child.field);
				}
			}
		}
	}

	// ─── Child management ─────────────────────────────────────────────────────

	function generateId(): string {
		return `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	function updateChild(index: number, updated: FilterNode) {
		const newChildren = [...group.children];
		newChildren[index] = updated;
		onUpdate({ ...group, children: newChildren });

		// Reload suggestions if leaf field changed
		if (!isFilterGroup(updated) && !isFilterGroup(group.children[index])) {
			const prev = group.children[index] as FilterCondition;
			if (prev.field !== updated.field && updated.field) {
				conditionValues.delete(updated.id);
				conditionRanges.delete(updated.id);
				loadSuggestionsForCondition(updated.id, updated.field);
			}
		}
	}

	function removeChild(index: number) {
		const removed = group.children[index];
		const newChildren = group.children.filter((_, i) => i !== index);
		onUpdate({ ...group, children: newChildren });

		if (!isFilterGroup(removed)) {
			conditionValues.delete(removed.id);
			conditionRanges.delete(removed.id);
		}
	}

	function addCondition() {
		const newCondition: FilterCondition = {
			id: generateId(),
			field: '',
			operator: 'equals',
			value: ''
		};
		onUpdate({ ...group, children: [...group.children, newCondition] });
	}

	function addSubGroup() {
		if (depth >= MAX_DEPTH) return;
		const newGroup: FilterGroup = {
			id: generateId(),
			logic: group.logic === 'and' ? 'or' : 'and',
			children: [
				{ id: generateId(), field: '', operator: 'equals', value: '' } as FilterCondition
			]
		};
		onUpdate({ ...group, children: [...group.children, newGroup] });
	}

	function makeGroupUpdateHandler(index: number): (updated: FilterGroup) => void {
		return (updated) => updateChild(index, updated);
	}

	function handleLogicChange(newLogic: FilterLogic) {
		onUpdate({ ...group, logic: newLogic });
	}
</script>

<div class="gridlite-filter-group gridlite-filter-group--depth-{Math.min(depth, 3)}">
	<div class="gridlite-filter-group-header">
		<select
			class="group-logic-select"
			value={group.logic}
			on:change={(e) => handleLogicChange(e.currentTarget.value === 'or' ? 'or' : 'and')}
		>
			<option value="and">AND</option>
			<option value="or">OR</option>
		</select>
		<span class="group-label">group</span>
		<button class="group-remove-btn" on:click={onRemove} title="Remove group" type="button">
			<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="gridlite-filter-group-children">
		{#each group.children as child, index (child.id)}
			{#if isFilterGroup(child)}
				<svelte:self
					group={child}
					depth={depth + 1}
					{db}
					{table}
					{source}
					{columns}
					{columnConfigs}
					{allowedColumns}
					onUpdate={makeGroupUpdateHandler(index)}
					onRemove={() => removeChild(index)}
				/>
			{:else}
				<div class="condition-row">
					{#if index === 0}
						<span class="filter-label">Where</span>
					{:else}
						<span class="logic-label">{group.logic}</span>
					{/if}
					<div class="condition-wrapper">
						<FilterConditionComponent
							condition={child}
							{columns}
							{columnConfigs}
							columnValues={conditionValues.get(child.id) ?? []}
							numericRange={conditionRanges.get(child.id) ?? null}
							onUpdate={(updated) => updateChild(index, updated)}
							onRemove={() => removeChild(index)}
						/>
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<div class="gridlite-filter-group-actions">
		<button class="add-condition-btn" on:click={addCondition} type="button">
			<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
			</svg>
			Condition
		</button>
		{#if depth < MAX_DEPTH}
			<button class="add-group-btn" on:click={addSubGroup} type="button">
				<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
				</svg>
				Group
			</button>
		{/if}
	</div>
</div>

<style>
	.gridlite-filter-group {
		border-left: 3px solid #c7d2fe;
		background: #fafbff;
		border-radius: 0.375rem;
		padding: 0.75rem;
		margin: 0.25rem 0;
	}

	.gridlite-filter-group--depth-1 {
		border-left-color: #a5b4fc;
		background: #f5f7ff;
	}

	.gridlite-filter-group--depth-2 {
		border-left-color: #818cf8;
		background: #eef1ff;
	}

	.gridlite-filter-group--depth-3 {
		border-left-color: #6366f1;
		background: #e8ebff;
	}

	.gridlite-filter-group-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.group-logic-select {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #4f46e5;
		background: white;
		border: 1px solid #c7d2fe;
		border-radius: 0.25rem;
		cursor: pointer;
	}

	.group-logic-select:hover {
		border-color: #818cf8;
	}

	.group-label {
		font-size: 0.75rem;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.group-remove-btn {
		margin-left: auto;
		padding: 0.25rem;
		background: none;
		border: none;
		color: #6b7280;
		cursor: pointer;
		border-radius: 0.25rem;
		transition: all 0.2s;
	}

	.group-remove-btn:hover {
		background: #fee2e2;
		color: #dc2626;
	}

	.gridlite-filter-group-children {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.condition-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.filter-label {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		min-width: 50px;
		padding: 0.375rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #374151;
		text-align: left;
		height: fit-content;
		margin-top: 0.5rem;
		box-sizing: border-box;
	}

	.logic-label {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		min-width: 50px;
		padding: 0.375rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: lowercase;
		height: fit-content;
		margin-top: 0.5rem;
		box-sizing: border-box;
	}

	.condition-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.gridlite-filter-group-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.add-condition-btn,
	.add-group-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		font-size: 0.8125rem;
		font-weight: 500;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.add-condition-btn {
		color: #4f46e5;
		background: white;
		border: 1px dashed #a5b4fc;
	}

	.add-condition-btn:hover {
		background: #eef2ff;
		border-style: solid;
	}

	.add-group-btn {
		color: #7c3aed;
		background: white;
		border: 1px dashed #c4b5fd;
	}

	.add-group-btn:hover {
		background: #f5f3ff;
		border-style: solid;
	}

	.icon {
		width: 0.875rem;
		height: 0.875rem;
	}
</style>
