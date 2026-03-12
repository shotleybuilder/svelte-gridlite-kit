<script lang="ts">
	/**
	 * CellContextMenu — Right-click context menu for grid cells.
	 *
	 * Actions: filter by value, exclude value, greater/less than (numeric).
	 * PGLite-native: uses callback props instead of event dispatch,
	 * ColumnMetadata instead of TanStack Column.
	 */

	import { onMount } from 'svelte';

	export let x: number;
	export let y: number;
	export let value: unknown;
	export let columnName: string;
	export let columnLabel: string;
	export let isNumeric: boolean = false;

	export let onFilterEquals: (columnName: string, value: unknown) => void;
	export let onFilterNotEquals: (columnName: string, value: unknown) => void;
	export let onFilterGreaterThan: ((columnName: string, value: unknown) => void) | undefined =
		undefined;
	export let onFilterLessThan: ((columnName: string, value: unknown) => void) | undefined =
		undefined;
	export let onClose: () => void;

	let menuRef: HTMLDivElement;

	// Truncate display value
	$: displayValue = (() => {
		const str = String(value ?? '');
		return str.length > 30 ? str.substring(0, 27) + '...' : str;
	})();

	// Keep menu in viewport
	$: adjustedPosition = (() => {
		let adjustedX = x;
		let adjustedY = y;

		if (typeof window !== 'undefined') {
			const menuWidth = 220;
			const menuHeight = isNumeric ? 180 : 100;

			if (x + menuWidth > window.innerWidth) {
				adjustedX = window.innerWidth - menuWidth - 10;
			}
			if (y + menuHeight > window.innerHeight) {
				adjustedY = window.innerHeight - menuHeight - 10;
			}
		}

		return { x: adjustedX, y: adjustedY };
	})();

	function handleFilterEquals() {
		onFilterEquals(columnName, value);
		onClose();
	}

	function handleFilterNotEquals() {
		onFilterNotEquals(columnName, value);
		onClose();
	}

	function handleFilterGreaterThan() {
		onFilterGreaterThan?.(columnName, value);
		onClose();
	}

	function handleFilterLessThan() {
		onFilterLessThan?.(columnName, value);
		onClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	function handleClickOutside(event: MouseEvent) {
		if (menuRef && !menuRef.contains(event.target as Node)) {
			onClose();
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		menuRef?.focus();

		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div
	bind:this={menuRef}
	class="cell-context-menu"
	style="top: {adjustedPosition.y}px; left: {adjustedPosition.x}px;"
	role="menu"
	tabindex="-1"
>
	<div class="menu-header">
		<span class="column-name">{columnLabel}</span>
	</div>

	<button class="menu-item" on:click={handleFilterEquals} role="menuitem">
		<svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
			/>
		</svg>
		<span>Filter by "<strong>{displayValue}</strong>"</span>
	</button>

	<button class="menu-item" on:click={handleFilterNotEquals} role="menuitem">
		<svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
			/>
		</svg>
		<span>Exclude "<strong>{displayValue}</strong>"</span>
	</button>

	{#if isNumeric}
		<div class="menu-divider"></div>

		<button class="menu-item" on:click={handleFilterGreaterThan} role="menuitem">
			<svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9 5l7 7-7 7"
				/>
			</svg>
			<span>Greater than <strong>{displayValue}</strong></span>
		</button>

		<button class="menu-item" on:click={handleFilterLessThan} role="menuitem">
			<svg class="menu-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 19l-7-7 7-7"
				/>
			</svg>
			<span>Less than <strong>{displayValue}</strong></span>
		</button>
	{/if}
</div>

<style>
	.cell-context-menu {
		position: fixed;
		z-index: 1000;
		min-width: 200px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.1),
			0 4px 6px -2px rgba(0, 0, 0, 0.05);
		padding: 0.25rem 0;
		outline: none;
	}

	.menu-header {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #e5e7eb;
		margin-bottom: 0.25rem;
	}

	.column-name {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		text-align: left;
		background: none;
		border: none;
		cursor: pointer;
		transition: background-color 0.1s;
	}

	.menu-item:hover {
		background: #f3f4f6;
	}

	.menu-item:focus {
		outline: none;
		background: #e5e7eb;
	}

	.menu-item span {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.menu-item strong {
		color: #1f2937;
	}

	.menu-icon {
		width: 1rem;
		height: 1rem;
		color: #6b7280;
		flex-shrink: 0;
	}

	.menu-divider {
		height: 1px;
		background: #e5e7eb;
		margin: 0.25rem 0;
	}
</style>
