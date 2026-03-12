<script lang="ts">
	/**
	 * SortCondition — Individual sort row with column picker and direction toggle.
	 *
	 * PGLite-native: uses ColumnMetadata instead of TanStack ColumnDef.
	 * Emits SortConfig (column + direction) instead of TanStack SortingState.
	 */

	import type { SortConfig, ColumnMetadata, ColumnConfig } from '../types.js';

	export let sort: SortConfig;
	export let columns: ColumnMetadata[];
	export let columnConfigs: ColumnConfig[] = [];
	export let existingSorts: SortConfig[];
	export let onUpdate: (column: string, direction: 'asc' | 'desc') => void;
	export let onRemove: () => void;

	const directionOptions = [
		{ value: 'asc', label: 'A → Z', icon: '↑' },
		{ value: 'desc', label: 'Z → A', icon: '↓' }
	];

	function getColumnLabel(col: ColumnMetadata): string {
		const cfg = columnConfigs.find((c) => c.name === col.name);
		return cfg?.label ?? col.name;
	}

	function handleColumnChange(event: Event) {
		const newColumn = (event.target as HTMLSelectElement).value;
		onUpdate(newColumn, sort.direction);
	}

	function handleDirectionChange(event: Event) {
		const direction = (event.target as HTMLSelectElement).value as 'asc' | 'desc';
		onUpdate(sort.column, direction);
	}

	// Available columns: include current column or columns not already sorted
	$: availableColumns = columns.filter((col) => {
		return col.name === sort.column || !existingSorts.some((s) => s.column === col.name);
	});

	$: columnOptions = availableColumns.map((col) => ({
		name: col.name,
		label: getColumnLabel(col)
	}));
</script>

<div class="sort-condition">
	<select class="field-select" value={sort.column} on:change={handleColumnChange}>
		<option value="">Select field...</option>
		{#each columnOptions as option}
			<option value={option.name}>
				{option.label}
			</option>
		{/each}
	</select>

	<select
		class="direction-select"
		value={sort.direction}
		on:change={handleDirectionChange}
		disabled={!sort.column}
	>
		{#each directionOptions as option}
			<option value={option.value}>
				{option.icon} {option.label}
			</option>
		{/each}
	</select>

	<button class="remove-btn" on:click={onRemove} title="Remove sort" type="button">
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

<style>
	.sort-condition {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #f9fafb;
		border-radius: 0.375rem;
	}

	.field-select,
	.direction-select {
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: white;
	}

	.field-select {
		flex: 1;
		min-width: 150px;
	}

	.direction-select {
		flex: 0.7;
		min-width: 120px;
	}

	.direction-select:disabled {
		background: #f3f4f6;
		color: #9ca3af;
		cursor: not-allowed;
	}

	.field-select:focus,
	.direction-select:focus {
		outline: none;
		border-color: #f59e0b;
		box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
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

	.icon {
		width: 1rem;
		height: 1rem;
	}
</style>
