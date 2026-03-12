<script lang="ts">
	/**
	 * ColumnMenu — Column header dropdown menu.
	 *
	 * Actions: sort asc/desc, filter by field, group by field, hide column.
	 * PGLite-native: uses callback props and SortConfig[] lookup
	 * instead of TanStack column.getIsSorted().
	 */

	import { onDestroy } from 'svelte';
	import type { SortConfig } from '../types.js';

	export let columnName: string;
	export let isOpen: boolean = false;
	export let sorting: SortConfig[] = [];
	export let canSort: boolean = true;
	export let canFilter: boolean = true;
	export let canGroup: boolean = true;

	export let onSort: (columnName: string, direction: 'asc' | 'desc') => void;
	export let onFilter: (columnName: string) => void;
	export let onGroup: (columnName: string) => void;
	export let onHide: (columnName: string) => void;
	export let onClose: () => void;

	let menuElement: HTMLElement;

	// Current sort direction for this column
	$: currentSort = (() => {
		const s = sorting.find((s) => s.column === columnName);
		return s?.direction ?? null;
	})();

	function handleSortAsc() {
		onSort(columnName, 'asc');
		onClose();
	}

	function handleSortDesc() {
		onSort(columnName, 'desc');
		onClose();
	}

	function handleFilter() {
		onFilter(columnName);
		onClose();
	}

	function handleGroup() {
		onGroup(columnName);
		onClose();
	}

	function handleHideColumn() {
		onHide(columnName);
		onClose();
	}

	function handleClickOutside(event: MouseEvent) {
		if (menuElement && !menuElement.contains(event.target as Node)) {
			onClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	$: if (typeof document !== 'undefined') {
		if (isOpen) {
			setTimeout(() => {
				document.addEventListener('mousedown', handleClickOutside);
				document.addEventListener('keydown', handleKeydown);
			}, 0);
		} else {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		}
	}

	onDestroy(() => {
		if (typeof document !== 'undefined') {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

{#if isOpen}
	<div class="column-menu" bind:this={menuElement}>
		{#if canSort}
			<button
				class="menu-item"
				class:active={currentSort === 'asc'}
				on:click={handleSortAsc}
			>
				<svg class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path
						d="M8 12V4M8 4L5 7M8 4L11 7"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<span>Sort A → Z</span>
				{#if currentSort === 'asc'}
					<span class="check-icon">✓</span>
				{/if}
			</button>

			<button
				class="menu-item"
				class:active={currentSort === 'desc'}
				on:click={handleSortDesc}
			>
				<svg class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path
						d="M8 4V12M8 12L11 9M8 12L5 9"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<span>Sort Z → A</span>
				{#if currentSort === 'desc'}
					<span class="check-icon">✓</span>
				{/if}
			</button>

			<div class="menu-divider"></div>
		{/if}

		{#if canFilter}
			<button class="menu-item" on:click={handleFilter}>
				<svg class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path
						d="M2 3h12M4 6h8M6 9h4M7 12h2"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<span>Filter by this field</span>
			</button>

			<div class="menu-divider"></div>
		{/if}

		{#if canGroup}
			<button class="menu-item" on:click={handleGroup}>
				<svg class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
					<path
						d="M2 4h12M4 8h8M6 12h4"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				<span>Group by this field</span>
			</button>

			<div class="menu-divider"></div>
		{/if}

		<button class="menu-item" on:click={handleHideColumn}>
			<svg class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
				<path
					d="M2 8C2 8 4.5 3 8 3C11.5 3 14 8 14 8C14 8 11.5 13 8 13C4.5 13 2 8 2 8Z"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5" />
				<line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" />
			</svg>
			<span>Hide field</span>
		</button>
	</div>
{/if}

<style>
	.column-menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 0.25rem;
		min-width: 12rem;
		background: white;
		border: 1px solid rgba(0, 0, 0, 0.1);
		border-radius: 0.375rem;
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
		padding: 0.25rem;
		z-index: 50;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: transparent;
		text-align: left;
		font-size: 0.875rem;
		cursor: pointer;
		border-radius: 0.25rem;
		transition: background-color 0.15s;
		color: #374151;
		position: relative;
	}

	.menu-item:hover {
		background-color: #f3f4f6;
	}

	.menu-item.active {
		background-color: #eff6ff;
		color: #1e40af;
	}

	.menu-item.active:hover {
		background-color: #dbeafe;
	}

	.menu-icon {
		flex-shrink: 0;
		color: #6b7280;
	}

	.menu-item:hover .menu-icon {
		color: #374151;
	}

	.menu-item.active .menu-icon {
		color: #3b82f6;
	}

	.check-icon {
		margin-left: auto;
		color: #3b82f6;
		font-weight: bold;
		font-size: 1rem;
	}

	.menu-divider {
		height: 1px;
		background-color: #e5e7eb;
		margin: 0.25rem 0;
	}
</style>
