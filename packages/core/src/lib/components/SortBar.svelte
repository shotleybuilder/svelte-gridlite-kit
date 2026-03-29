<script lang="ts">
	/**
	 * SortBar — Multi-column sort controls.
	 *
	 * Emits SortConfig[] which maps to ORDER BY in the query builder.
	 * Uses ColumnMetadata instead of TanStack ColumnDef.
	 */

	import type { SortConfig, ColumnMetadata, ColumnConfig } from '../types.js';
	import SortConditionComponent from './SortCondition.svelte';

	export let columns: ColumnMetadata[];
	export let columnConfigs: ColumnConfig[] = [];
	export let sorting: SortConfig[] = [];
	export let onSortingChange: (sorting: SortConfig[]) => void;
	export let isExpanded = false;
	export let onExpandedChange: ((expanded: boolean) => void) | undefined = undefined;

	function setExpanded(value: boolean) {
		isExpanded = value;
		if (onExpandedChange) {
			onExpandedChange(value);
		}
	}

	function addSort() {
		const newSort: SortConfig = { column: '', direction: 'asc' };
		onSortingChange([...sorting, newSort]);
		setExpanded(true);
	}

	function updateSort(index: number, column: string, direction: 'asc' | 'desc') {
		const newSorting = [...sorting];
		newSorting[index] = { column, direction };
		onSortingChange(newSorting);
	}

	function removeSort(index: number) {
		const newSorting = sorting.filter((_, i) => i !== index);
		onSortingChange(newSorting);
		if (newSorting.length === 0) {
			setExpanded(false);
		}
	}

	function clearAllSorts() {
		onSortingChange([]);
		setExpanded(false);
	}

	// Columns not yet in sorting list
	$: availableColumnsForNew = columns.filter(
		(col) => !sorting.some((s) => s.column === col.name)
	);

	$: hasSorts = sorting.length > 0;
	$: validSortCount = sorting.filter((s) => s.column !== '').length;
	$: canAddMore = availableColumnsForNew.length > 0;
</script>

<div class="sort-bar">
	<button class="sort-toggle-btn" on:click={() => setExpanded(!isExpanded)}>
		<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
			/>
		</svg>
		Sort
		{#if validSortCount > 0}
			<span class="sort-badge">{validSortCount}</span>
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
		<div class="sort-panel">
			{#if hasSorts}
				<div class="sort-header">
					<span class="sort-label">Sort by</span>
					<button class="clear-all-btn" on:click={clearAllSorts}> Clear all </button>
				</div>

				<div class="sort-levels">
					{#each sorting as sort, index (index)}
						<SortConditionComponent
							{sort}
							{columns}
							{columnConfigs}
							existingSorts={sorting}
							onUpdate={(column, direction) => updateSort(index, column, direction)}
							onRemove={() => removeSort(index)}
						/>
					{/each}
				</div>
			{/if}

			<button class="add-sort-btn" on:click={addSort} disabled={!canAddMore}>
				<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 6v6m0 0v6m0-6h6m-6 0H6"
					/>
				</svg>
				{hasSorts ? 'Add another sort' : 'Add a sort'}
			</button>
		</div>
	{/if}
</div>

<style>
	.sort-bar {
		position: relative;
	}

	.sort-toggle-btn {
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

	.sort-toggle-btn:hover {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.sort-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: white;
		background: #f59e0b;
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

	.sort-panel {
		position: absolute;
		top: calc(100% + 0.5rem);
		left: 0;
		z-index: 20;
		min-width: 400px;
		padding: 1rem;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
	}

	.sort-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.sort-label {
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

	.sort-levels {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.add-sort-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #f59e0b;
		background: white;
		border: 1px dashed #f59e0b;
		border-radius: 0.375rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.add-sort-btn:hover:not(:disabled) {
		background: #fef3c7;
		border-style: solid;
	}

	.add-sort-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.icon {
		width: 1rem;
		height: 1rem;
	}
</style>
