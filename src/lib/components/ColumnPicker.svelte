<script lang="ts">
	/**
	 * ColumnPicker — Column visibility management with search and grouped sections.
	 *
	 * Splits columns into Visible and Hidden sections, with an intra-control
	 * search filter. Matches Airtable's column picker pattern.
	 */

	import { tick } from 'svelte';
	import type { ColumnMetadata, ColumnConfig } from '../types.js';

	export let columns: ColumnMetadata[];
	export let columnConfigs: ColumnConfig[] = [];
	export let columnVisibility: Record<string, boolean> = {};
	export let columnOrder: string[] = [];
	export let isOpen: boolean;
	export let defaultVisibleColumns: string[] | undefined = undefined;
	export let onVisibilityChange: (column: string, visible: boolean) => void;
	export let onToggleAll: (show: boolean) => void;
	let searchQuery = '';
	let searchInput: HTMLInputElement;

	// Auto-focus search input when picker opens
	$: if (isOpen) {
		tick().then(() => {
			searchInput?.focus();
		});
	} else {
		searchQuery = '';
	}

	function getLabel(col: ColumnMetadata): string {
		const cfg = columnConfigs.find((c) => c.name === col.name);
		return cfg?.label ?? col.name;
	}

	function isVisible(columnName: string, vis: Record<string, boolean>): boolean {
		if (columnName in vis) {
			return vis[columnName];
		}
		if (defaultVisibleColumns) {
			return defaultVisibleColumns.includes(columnName);
		}
		return true;
	}

	// Order columns consistently using columnOrder or schema order
	function ordered(cols: ColumnMetadata[]): ColumnMetadata[] {
		const order = columnOrder.length > 0 ? columnOrder : [];
		if (order.length === 0) return cols;
		return [...cols].sort((a, b) => {
			const ai = order.indexOf(a.name);
			const bi = order.indexOf(b.name);
			if (ai === -1 && bi === -1) return 0;
			if (ai === -1) return 1;
			if (bi === -1) return -1;
			return ai - bi;
		});
	}

	// Filter by search query (substring match on label and name)
	function matchesSearch(col: ColumnMetadata): boolean {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		const label = getLabel(col).toLowerCase();
		const name = col.name.toLowerCase();
		return label.includes(q) || name.includes(q);
	}

	$: filteredColumns = columns.filter((col) => {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		const label = getLabel(col).toLowerCase();
		const name = col.name.toLowerCase();
		return label.includes(q) || name.includes(q);
	});
	$: visibleCols = ordered(filteredColumns.filter((c) => isVisible(c.name, columnVisibility)));
	$: hiddenCols = ordered(filteredColumns.filter((c) => !isVisible(c.name, columnVisibility)));

	// Total counts (unfiltered, for section headers)
	$: totalVisible = columns.filter((c) => isVisible(c.name, columnVisibility)).length;
	$: totalHidden = columns.length - totalVisible;
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div class="gridlite-column-picker" on:click|stopPropagation>
		<!-- Search -->
		<div class="gridlite-column-picker-search">
			<svg class="gridlite-column-picker-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<input
				bind:this={searchInput}
				class="gridlite-column-picker-search-input"
				type="text"
				placeholder="Find a column..."
				bind:value={searchQuery}
			/>
			{#if searchQuery}
				<button
					class="gridlite-column-picker-search-clear"
					on:click={() => { searchQuery = ''; searchInput?.focus(); }}
					type="button"
					title="Clear search"
				>
					<svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>

		<!-- Actions -->
		<div class="gridlite-column-picker-actions">
			<button type="button" on:click={() => onToggleAll(true)}>Show All</button>
			<button type="button" on:click={() => onToggleAll(false)}>Hide All</button>
		</div>

		<div class="gridlite-column-picker-list">
			<!-- Visible section -->
			<div class="gridlite-column-picker-section">
				<div class="gridlite-column-picker-section-header">
					<span>Visible</span>
					<span class="gridlite-column-picker-section-count">{totalVisible}</span>
				</div>
				{#each visibleCols as col (col.name)}
					<label class="gridlite-column-picker-item">
						<span class="gridlite-column-picker-grab">
							<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
								<circle cx="3" cy="2" r="1" /><circle cx="7" cy="2" r="1" />
								<circle cx="3" cy="5" r="1" /><circle cx="7" cy="5" r="1" />
								<circle cx="3" cy="8" r="1" /><circle cx="7" cy="8" r="1" />
							</svg>
						</span>
						<input
							type="checkbox"
							checked={true}
							on:change={() => onVisibilityChange(col.name, false)}
						/>
						<span class="gridlite-column-picker-item-label">{getLabel(col)}</span>
					</label>
				{/each}
				{#if visibleCols.length === 0}
					<div class="gridlite-column-picker-empty">
						{searchQuery ? 'No matching visible columns' : 'No visible columns'}
					</div>
				{/if}
			</div>

			<!-- Hidden section -->
			<div class="gridlite-column-picker-section">
				<div class="gridlite-column-picker-section-header">
					<span>Hidden</span>
					<span class="gridlite-column-picker-section-count">{totalHidden}</span>
				</div>
				{#each hiddenCols as col (col.name)}
					<label class="gridlite-column-picker-item gridlite-column-picker-item-hidden">
						<span class="gridlite-column-picker-grab">
							<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
								<circle cx="3" cy="2" r="1" /><circle cx="7" cy="2" r="1" />
								<circle cx="3" cy="5" r="1" /><circle cx="7" cy="5" r="1" />
								<circle cx="3" cy="8" r="1" /><circle cx="7" cy="8" r="1" />
							</svg>
						</span>
						<input
							type="checkbox"
							checked={false}
							on:change={() => onVisibilityChange(col.name, true)}
						/>
						<span class="gridlite-column-picker-item-label">{getLabel(col)}</span>
					</label>
				{/each}
				{#if hiddenCols.length === 0}
					<div class="gridlite-column-picker-empty">
						{searchQuery ? 'No matching hidden columns' : 'No hidden columns'}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
