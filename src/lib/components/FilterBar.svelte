<script lang="ts">
	/**
	 * FilterBar — Advanced filtering UI panel.
	 *
	 * PGLite-native: fetches column value suggestions via SELECT DISTINCT
	 * and numeric ranges via SELECT MIN(), MAX() — no in-memory data scanning.
	 */

	import type {
		FilterCondition,
		FilterLogic,
		ColumnMetadata,
		ColumnConfig
	} from '../types.js';
	import type { PGliteWithLive } from '../query/live.js';
	import { quoteIdentifier, resolveFrom } from '../query/builder.js';
	import FilterConditionComponent from './FilterCondition.svelte';

	/** PGLite instance for running suggestion queries */
	export let db: PGliteWithLive;

	/** Table name for suggestion queries (mutually exclusive with `source`) */
	export let table: string = '';

	/** Raw SQL subquery source for suggestion queries (mutually exclusive with `table`) */
	export let source: string = '';

	/** Introspected column metadata */
	export let columns: ColumnMetadata[];

	/** Column config overrides (labels, dataType, selectOptions) */
	export let columnConfigs: ColumnConfig[] = [];

	/** Allowed column names for query safety */
	export let allowedColumns: string[] = [];

	/** Current filter conditions */
	export let conditions: FilterCondition[] = [];
	export let onConditionsChange: (conditions: FilterCondition[]) => void;

	/** Filter logic (AND/OR) */
	export let logic: FilterLogic = 'and';
	export let onLogicChange: (logic: FilterLogic) => void;

	/** Expand/collapse state */
	export let isExpanded = false;
	export let onExpandedChange: ((expanded: boolean) => void) | undefined = undefined;

	// ─── Value suggestion caches ──────────────────────────────────────────────

	let columnValuesCache: Map<string, string[]> = new Map();
	let numericRangeCache: Map<string, { min: number; max: number } | null> = new Map();

	/**
	 * Fetch distinct values for a column via SQL.
	 * Results are cached per column name.
	 */
	async function getColumnValues(columnName: string): Promise<string[]> {
		if (!columnName || (!table && !source)) return [];

		if (columnValuesCache.has(columnName)) {
			return columnValuesCache.get(columnName)!;
		}

		try {
			const fromClause = resolveFrom(table || undefined, source || undefined);
			const quotedCol = quoteIdentifier(columnName, allowedColumns);
			const sql = `SELECT DISTINCT ${quotedCol}::TEXT AS val FROM ${fromClause} WHERE ${quotedCol} IS NOT NULL ORDER BY val LIMIT 200`;
			const result = await db.query<{ val: string }>(sql);
			const values = result.rows.map((r) => r.val);
			columnValuesCache.set(columnName, values);
			return values;
		} catch {
			columnValuesCache.set(columnName, []);
			return [];
		}
	}

	/**
	 * Fetch min/max range for a numeric column via SQL.
	 * Results are cached per column name.
	 */
	async function getNumericRange(columnName: string): Promise<{ min: number; max: number } | null> {
		if (!columnName || (!table && !source)) return null;

		if (numericRangeCache.has(columnName)) {
			return numericRangeCache.get(columnName)!;
		}

		// Only query for numeric columns
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

	// ─── Per-condition loaded suggestions ─────────────────────────────────────

	// Reactive stores for each condition's loaded values
	let conditionValues: Map<string, string[]> = new Map();
	let conditionRanges: Map<string, { min: number; max: number } | null> = new Map();

	// Load suggestions when a condition's field changes
	async function loadSuggestionsForCondition(conditionId: string, field: string) {
		if (!field) return;

		const values = await getColumnValues(field);
		conditionValues.set(conditionId, values);
		conditionValues = conditionValues; // trigger reactivity

		const range = await getNumericRange(field);
		conditionRanges.set(conditionId, range);
		conditionRanges = conditionRanges; // trigger reactivity
	}

	// Watch conditions for field changes and load suggestions
	$: {
		for (const cond of conditions) {
			if (cond.field) {
				const cached = conditionValues.get(cond.id);
				// Load on first appearance or if field changed (cache miss implied by new field)
				if (cached === undefined) {
					loadSuggestionsForCondition(cond.id, cond.field);
				}
			}
		}
	}

	// ─── Condition management ─────────────────────────────────────────────────

	function generateId(): string {
		return `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	function addCondition() {
		const newCondition: FilterCondition = {
			id: generateId(),
			field: '',
			operator: 'equals',
			value: ''
		};
		onConditionsChange([...conditions, newCondition]);
		setExpanded(true);
	}

	function setExpanded(value: boolean) {
		isExpanded = value;
		if (onExpandedChange) {
			onExpandedChange(value);
		}
	}

	function updateCondition(index: number, updated: FilterCondition) {
		const prev = conditions[index];
		const newConditions = [...conditions];
		newConditions[index] = updated;
		onConditionsChange(newConditions);

		// If field changed, reload suggestions
		if (prev.field !== updated.field && updated.field) {
			// Clear old cache entry for this condition
			conditionValues.delete(updated.id);
			conditionRanges.delete(updated.id);
			loadSuggestionsForCondition(updated.id, updated.field);
		}
	}

	function removeCondition(index: number) {
		const removed = conditions[index];
		const newConditions = conditions.filter((_, i) => i !== index);
		onConditionsChange(newConditions);

		// Clean up caches for removed condition
		conditionValues.delete(removed.id);
		conditionRanges.delete(removed.id);

		if (newConditions.length === 0) {
			setExpanded(false);
		}
	}

	function clearAllConditions() {
		onConditionsChange([]);
		conditionValues.clear();
		conditionRanges.clear();
		conditionValues = conditionValues;
		conditionRanges = conditionRanges;
		setExpanded(false);
	}

	/** Invalidate suggestion caches (call after data changes). */
	export function invalidateCaches() {
		columnValuesCache.clear();
		numericRangeCache.clear();
		conditionValues.clear();
		conditionRanges.clear();
		conditionValues = conditionValues;
		conditionRanges = conditionRanges;
	}

	// ─── Computed ─────────────────────────────────────────────────────────────

	$: hasConditions = conditions.length > 0;
	$: filterCount = conditions.filter(
		(c) =>
			c.field &&
			(c.operator === 'is_empty' ||
				c.operator === 'is_not_empty' ||
				(c.value !== null && c.value !== undefined && c.value !== ''))
	).length;
</script>

<div class="filter-bar">
	<button class="filter-toggle-btn" on:click={() => setExpanded(!isExpanded)}>
		<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
			/>
		</svg>
		Filter
		{#if filterCount > 0}
			<span class="filter-badge">{filterCount}</span>
		{/if}
		<svg class="chevron" class:expanded={isExpanded} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isExpanded}
		<div class="filter-panel">
			{#if hasConditions}
				<div class="filter-header">
					<button class="clear-all-btn" on:click={clearAllConditions}> Clear all </button>
				</div>

				<div class="filter-conditions">
					{#each conditions as condition, index (condition.id)}
						<div class="condition-row">
							{#if index === 0}
								<span class="filter-label">Where</span>
							{:else}
								<select
									class="logic-select"
									value={logic}
									on:change={(e) => {
										const newLogic = e.currentTarget.value;
										onLogicChange(newLogic === 'or' ? 'or' : 'and');
									}}
								>
									<option value="and">and</option>
									<option value="or">or</option>
								</select>
							{/if}
							<div class="condition-wrapper">
								<FilterConditionComponent
									{condition}
									{columns}
									{columnConfigs}
									columnValues={conditionValues.get(condition.id) ?? []}
									numericRange={conditionRanges.get(condition.id) ?? null}
									onUpdate={(updated) => updateCondition(index, updated)}
									onRemove={() => removeCondition(index)}
								/>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<button class="add-condition-btn" on:click={addCondition}>
				<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 6v6m0 0v6m0-6h6m-6 0H6"
					/>
				</svg>
				Add condition
			</button>
		</div>
	{/if}
</div>

<style>
	.filter-bar {
		position: relative;
	}

	.filter-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.filter-toggle-btn:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.filter-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: white;
		background: #4f46e5;
		border-radius: 0.75rem;
	}

	.chevron {
		width: 1rem;
		height: 1rem;
		transition: transform 0.2s;
	}

	.chevron.expanded {
		transform: rotate(180deg);
	}

	.filter-panel {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		z-index: 20;
		min-width: 600px;
		padding: 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
	}

	.filter-header {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.filter-label {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		min-width: 60px;
		padding: 0.375rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #374151;
		text-align: left;
		height: fit-content;
		margin-top: 0.5rem;
		box-sizing: border-box;
	}

	.clear-all-btn {
		font-size: 0.75rem;
		color: #6b7280;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		transition: all 0.2s;
	}

	.clear-all-btn:hover {
		color: #dc2626;
		background: #fee2e2;
	}

	.filter-conditions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.condition-row {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.logic-select {
		flex-shrink: 0;
		padding: 0.375rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: lowercase;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		cursor: pointer;
		min-width: 60px;
		height: fit-content;
		margin-top: 0.5rem;
	}

	.logic-select:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.logic-select:focus {
		outline: none;
		border-color: #4f46e5;
		box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
	}

	.condition-wrapper {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.add-condition-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #4f46e5;
		background: white;
		border: 1px dashed #4f46e5;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.add-condition-btn:hover {
		background: #eef2ff;
		border-style: solid;
	}

	.icon {
		width: 1rem;
		height: 1rem;
	}
</style>
