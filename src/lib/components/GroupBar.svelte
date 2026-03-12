<script lang="ts">
	/**
	 * GroupBar — Multi-level grouping controls with aggregation support.
	 *
	 * Emits GroupConfig[] which maps to GROUP BY with SUM/AVG/COUNT/MIN/MAX
	 * in the query builder. Up to 3 nested group levels.
	 *
	 * PGLite-native: uses GroupConfig with AggregationConfig for SQL aggregates,
	 * unlike svelte-table-kit which used simple string[] grouping.
	 */

	import type {
		GroupConfig,
		AggregationConfig,
		AggregateFunction,
		ColumnMetadata,
		ColumnConfig
	} from '../types.js';

	export let columns: ColumnMetadata[];
	export let columnConfigs: ColumnConfig[] = [];
	export let grouping: GroupConfig[] = [];
	export let onGroupingChange: (grouping: GroupConfig[]) => void;
	export let isExpanded = false;
	export let onExpandedChange: ((expanded: boolean) => void) | undefined = undefined;

	const MAX_LEVELS = 3;

	const aggregateFunctions: { value: AggregateFunction; label: string }[] = [
		{ value: 'count', label: 'Count' },
		{ value: 'sum', label: 'Sum' },
		{ value: 'avg', label: 'Average' },
		{ value: 'min', label: 'Min' },
		{ value: 'max', label: 'Max' }
	];

	function getColumnLabel(col: ColumnMetadata): string {
		const cfg = columnConfigs.find((c) => c.name === col.name);
		return cfg?.label ?? col.name;
	}

	function setExpanded(value: boolean) {
		isExpanded = value;
		if (onExpandedChange) {
			onExpandedChange(value);
		}
	}

	function addGroup() {
		if (grouping.length >= MAX_LEVELS) return;
		onGroupingChange([...grouping, { column: '' }]);
		setExpanded(true);
	}

	function updateGroupColumn(index: number, column: string) {
		const newGrouping = [...grouping];
		newGrouping[index] = { ...newGrouping[index], column };
		onGroupingChange(newGrouping);
	}

	function removeGroup(index: number) {
		const newGrouping = grouping.filter((_, i) => i !== index);
		onGroupingChange(newGrouping);
		if (newGrouping.length === 0) {
			setExpanded(false);
		}
	}

	function clearAllGroups() {
		onGroupingChange([]);
		setExpanded(false);
	}

	// ─── Aggregation management ───────────────────────────────────────────────

	function addAggregation(groupIndex: number) {
		const newGrouping = [...grouping];
		const group = { ...newGrouping[groupIndex] };
		const agg: AggregationConfig = { column: '', function: 'count' };
		group.aggregations = [...(group.aggregations ?? []), agg];
		newGrouping[groupIndex] = group;
		onGroupingChange(newGrouping);
	}

	function updateAggregation(
		groupIndex: number,
		aggIndex: number,
		updates: Partial<AggregationConfig>
	) {
		const newGrouping = [...grouping];
		const group = { ...newGrouping[groupIndex] };
		const aggs = [...(group.aggregations ?? [])];
		aggs[aggIndex] = { ...aggs[aggIndex], ...updates };
		group.aggregations = aggs;
		newGrouping[groupIndex] = group;
		onGroupingChange(newGrouping);
	}

	function removeAggregation(groupIndex: number, aggIndex: number) {
		const newGrouping = [...grouping];
		const group = { ...newGrouping[groupIndex] };
		group.aggregations = (group.aggregations ?? []).filter((_, i) => i !== aggIndex);
		newGrouping[groupIndex] = group;
		onGroupingChange(newGrouping);
	}

	function handleAggFunctionChange(groupIndex: number, aggIndex: number, value: string) {
		const updates: Partial<AggregationConfig> = {};
		updates.function = value as AggregateFunction;
		updateAggregation(groupIndex, aggIndex, updates);
	}

	// Numeric columns (for sum/avg aggregations)
	$: numericColumns = columns.filter((col) => {
		const cfg = columnConfigs.find((c) => c.name === col.name);
		const dt = cfg?.dataType ?? col.dataType;
		return dt === 'number';
	});

	$: hasGroups = grouping.length > 0;
	$: validGroupCount = grouping.filter((g) => g.column !== '').length;
	$: canAddMore = grouping.length < MAX_LEVELS;
</script>

<div class="group-bar">
	<button class="group-toggle-btn" on:click={() => setExpanded(!isExpanded)}>
		<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 6h16M4 10h16M4 14h16M4 18h16"
			/>
		</svg>
		Group
		{#if validGroupCount > 0}
			<span class="group-badge">{validGroupCount}</span>
		{/if}
		<svg
			class="chevron"
			class:expanded={isExpanded}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isExpanded}
		<div class="group-panel">
			{#if hasGroups}
				<div class="group-header">
					<span class="group-label">Group by</span>
					<button class="clear-all-btn" on:click={clearAllGroups}> Clear all </button>
				</div>

				<div class="group-levels">
					{#each grouping as group, index (index)}
						<div class="group-level">
							<div class="group-level-row">
								<select
									class="field-select"
									value={group.column}
									on:change={(e) => updateGroupColumn(index, e.currentTarget.value)}
								>
									<option value="">Select field...</option>
									{#each columns as column}
										<option value={column.name}>
											{getColumnLabel(column)}
										</option>
									{/each}
								</select>

								<button class="remove-btn" on:click={() => removeGroup(index)} title="Remove group" type="button">
									<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>

							{#if group.column}
								<!-- Aggregations for this group level -->
								{#if group.aggregations && group.aggregations.length > 0}
									<div class="aggregations">
										{#each group.aggregations as agg, aggIndex}
											<div class="aggregation-row">
												<select
													class="agg-function-select"
													value={agg.function}
													on:change={(e) => handleAggFunctionChange(index, aggIndex, e.currentTarget.value)}
												>
													{#each aggregateFunctions as fn}
														<option value={fn.value}>{fn.label}</option>
													{/each}
												</select>

												<select
													class="agg-column-select"
													value={agg.column}
													on:change={(e) =>
														updateAggregation(index, aggIndex, {
															column: e.currentTarget.value
														})}
												>
													<option value="">Select column...</option>
													{#if agg.function === 'count'}
														<option value="*">All rows (*)</option>
													{/if}
													{#each agg.function === 'sum' || agg.function === 'avg' ? numericColumns : columns as col}
														<option value={col.name}>{getColumnLabel(col)}</option>
													{/each}
												</select>

												<button
													class="remove-btn small"
													on:click={() => removeAggregation(index, aggIndex)}
													title="Remove aggregation"
													type="button"
												>
													<svg class="icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M6 18L18 6M6 6l12 12"
														/>
													</svg>
												</button>
											</div>
										{/each}
									</div>
								{/if}

								<button
									class="add-agg-btn"
									on:click={() => addAggregation(index)}
									type="button"
								>
									+ Add aggregation
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			{#if canAddMore}
				<button class="add-group-btn" on:click={addGroup}>
					<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6v6m0 0v6m0-6h6m-6 0H6"
						/>
					</svg>
					{hasGroups ? 'Add subgroup' : 'Add group'}
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.group-bar {
		position: relative;
	}

	.group-toggle-btn {
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

	.group-toggle-btn:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.group-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: white;
		background: #059669;
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

	.group-panel {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		z-index: 20;
		min-width: 450px;
		padding: 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
	}

	.group-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.group-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
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

	.group-levels {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.group-level {
		padding: 0.5rem;
		background: #f9fafb;
		border-radius: 0.375rem;
	}

	.group-level-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.field-select {
		flex: 1;
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: white;
	}

	.field-select:focus {
		outline: none;
		border-color: #059669;
		box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
	}

	/* Aggregation rows */
	.aggregations {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-top: 0.5rem;
		padding-left: 1rem;
	}

	.aggregation-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.agg-function-select,
	.agg-column-select {
		padding: 0.25rem 0.5rem;
		font-size: 0.8125rem;
		border: 1px solid #d1d5db;
		border-radius: 0.25rem;
		background: white;
	}

	.agg-function-select {
		min-width: 90px;
	}

	.agg-column-select {
		flex: 1;
		min-width: 120px;
	}

	.agg-function-select:focus,
	.agg-column-select:focus {
		outline: none;
		border-color: #059669;
		box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.1);
	}

	.add-agg-btn {
		display: inline-block;
		margin-top: 0.375rem;
		margin-left: 1rem;
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		color: #6b7280;
		background: none;
		border: none;
		cursor: pointer;
		border-radius: 0.25rem;
		transition: all 0.15s;
	}

	.add-agg-btn:hover {
		color: #059669;
		background: #d1fae5;
	}

	.remove-btn {
		flex-shrink: 0;
		padding: 0.375rem;
		background: none;
		border: none;
		color: #6b7280;
		cursor: pointer;
		border-radius: 0.25rem;
		transition: all 0.2s;
	}

	.remove-btn:hover {
		background: #fee2e2;
		color: #dc2626;
	}

	.remove-btn.small {
		padding: 0.25rem;
	}

	.add-group-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #059669;
		background: white;
		border: 1px dashed #059669;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.add-group-btn:hover {
		background: #d1fae5;
		border-style: solid;
	}

	.icon {
		width: 1rem;
		height: 1rem;
	}

	.icon-sm {
		width: 0.875rem;
		height: 0.875rem;
	}
</style>
