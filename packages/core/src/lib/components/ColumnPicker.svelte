<script lang="ts">
	/**
	 * ColumnPicker — Column visibility management with search, grouped sections,
	 * drag-to-reorder, and multi-select.
	 *
	 * - Visible/Hidden sections with count badges
	 * - Intra-control search (substring match on label + name)
	 * - HTML5 Drag and Drop reordering within sections and across sections
	 * - Multi-select: Click, Ctrl/Cmd+Click, Shift+Click
	 * - Multi-column drag (moves all selected as group)
	 * - Keyboard: Arrow keys, Space, Ctrl+A, Escape
	 */

	import { tick } from 'svelte';
	import type { ColumnMetadata, ColumnConfig } from '../types.js';

	// ─── Props ────────────────────────────────────────────────────────────────

	let {
		columns,
		columnConfigs = [],
		columnVisibility = {},
		columnOrder = [],
		isOpen,
		defaultVisibleColumns = undefined,
		onVisibilityChange,
		onToggleAll,
		onOrderChange = undefined
	}: {
		columns: ColumnMetadata[];
		columnConfigs?: ColumnConfig[];
		columnVisibility?: Record<string, boolean>;
		columnOrder?: string[];
		isOpen: boolean;
		defaultVisibleColumns?: string[] | undefined;
		onVisibilityChange: (column: string, visible: boolean) => void;
		onToggleAll: (show: boolean) => void;
		onOrderChange?: ((newOrder: string[]) => void) | undefined;
	} = $props();

	// ─── Internal State ───────────────────────────────────────────────────────

	let searchQuery = $state('');
	let searchInput = $state<HTMLInputElement>(undefined!);

	// Multi-select state
	let selectedColumns: Set<string> = $state(new Set());
	let lastClickedColumn: string | null = $state(null);

	// Drag state
	let draggedColumns: string[] = $state([]);
	let dropTargetColumn: string | null = $state(null);
	let dropPosition: 'before' | 'after' | null = $state(null);
	let dropTargetSection: 'visible' | 'hidden' | null = $state(null);

	// Keyboard focus
	let focusedIndex = $state(-1);
	let listContainer = $state<HTMLDivElement>(undefined!);

	// ─── Auto-focus & Reset ───────────────────────────────────────────────────

	$effect(() => {
		if (isOpen) {
			tick().then(() => {
				searchInput?.focus();
			});
		} else {
			searchQuery = '';
			selectedColumns = new Set();
			lastClickedColumn = null;
			focusedIndex = -1;
		}
	});

	// ─── Helpers ──────────────────────────────────────────────────────────────

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

	function ordered(cols: ColumnMetadata[], order: string[]): ColumnMetadata[] {
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

	// ─── Reactive Computeds ───────────────────────────────────────────────────

	let filteredColumns = $derived(columns.filter((col) => {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		const label = getLabel(col).toLowerCase();
		const name = col.name.toLowerCase();
		return label.includes(q) || name.includes(q);
	}));
	let visibleCols = $derived(ordered(filteredColumns.filter((c) => isVisible(c.name, columnVisibility)), columnOrder));
	let hiddenCols = $derived(ordered(filteredColumns.filter((c) => !isVisible(c.name, columnVisibility)), columnOrder));

	// Flat list for keyboard navigation (visible first, then hidden)
	let allItems = $derived([...visibleCols, ...hiddenCols]);

	// Total counts (unfiltered)
	let totalVisible = $derived(columns.filter((c) => isVisible(c.name, columnVisibility)).length);
	let totalHidden = $derived(columns.length - totalVisible);

	// ─── Multi-Select ─────────────────────────────────────────────────────────

	function handleItemClick(event: MouseEvent, colName: string) {
		const isMeta = event.metaKey || event.ctrlKey;
		const isShift = event.shiftKey;

		if (isShift && lastClickedColumn) {
			// Shift+Click: range select within the flat list
			const lastIdx = allItems.findIndex((c) => c.name === lastClickedColumn);
			const curIdx = allItems.findIndex((c) => c.name === colName);
			if (lastIdx !== -1 && curIdx !== -1) {
				const start = Math.min(lastIdx, curIdx);
				const end = Math.max(lastIdx, curIdx);
				const next = new Set(selectedColumns);
				for (let i = start; i <= end; i++) {
					next.add(allItems[i].name);
				}
				selectedColumns = next;
			}
		} else if (isMeta) {
			// Ctrl/Cmd+Click: toggle individual
			const next = new Set(selectedColumns);
			if (next.has(colName)) {
				next.delete(colName);
			} else {
				next.add(colName);
			}
			selectedColumns = next;
		} else {
			// Plain click: select only this one
			selectedColumns = new Set([colName]);
		}
		lastClickedColumn = colName;
	}

	// ─── Drag and Drop ───────────────────────────────────────────────────────

	function handleDragStart(event: DragEvent, colName: string) {
		if (!event.dataTransfer) return;

		// If the dragged column is in the selection, drag all selected
		// Otherwise, drag just this one column
		if (selectedColumns.has(colName) && selectedColumns.size > 1) {
			draggedColumns = allItems
				.filter((c) => selectedColumns.has(c.name))
				.map((c) => c.name);
		} else {
			draggedColumns = [colName];
			selectedColumns = new Set([colName]);
		}

		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', draggedColumns.join(','));

		// Custom drag image with count badge for multi-drag
		if (draggedColumns.length > 1) {
			const ghost = document.createElement('div');
			ghost.className = 'gridlite-column-picker-drag-ghost';
			ghost.textContent = `${draggedColumns.length} columns`;
			document.body.appendChild(ghost);
			event.dataTransfer.setDragImage(ghost, 0, 0);
			requestAnimationFrame(() => ghost.remove());
		}
	}

	function handleDragOver(event: DragEvent, colName: string, section: 'visible' | 'hidden') {
		if (draggedColumns.length === 0) return;
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}

		// Determine before/after based on mouse position within the element
		const target = (event.currentTarget as HTMLElement);
		const rect = target.getBoundingClientRect();
		const midY = rect.top + rect.height / 2;
		dropPosition = event.clientY < midY ? 'before' : 'after';
		dropTargetColumn = colName;
		dropTargetSection = section;
	}

	function handleDragOverSection(event: DragEvent, section: 'visible' | 'hidden') {
		// Allow drop on empty section area
		if (draggedColumns.length === 0) return;
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		dropTargetSection = section;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		if (draggedColumns.length === 0) return;

		const targetSection = dropTargetSection;
		const targetCol = dropTargetColumn;
		const pos = dropPosition;

		// 1. Handle visibility changes for cross-section moves
		if (targetSection) {
			for (const colName of draggedColumns) {
				const currentlyVisible = isVisible(colName, columnVisibility);
				if (targetSection === 'visible' && !currentlyVisible) {
					onVisibilityChange(colName, true);
				} else if (targetSection === 'hidden' && currentlyVisible) {
					onVisibilityChange(colName, false);
				}
			}
		}

		// 2. Handle reordering within the visible section
		if (targetSection === 'visible' && onOrderChange) {
			// Build the current effective order
			let currentOrder = columnOrder.length > 0
				? [...columnOrder]
				: columns.map((c) => c.name);

			// Remove dragged columns from current order
			const remaining = currentOrder.filter((name) => !draggedColumns.includes(name));

			// Find insertion point
			if (targetCol && pos) {
				const insertIdx = remaining.indexOf(targetCol);
				if (insertIdx !== -1) {
					const finalIdx = pos === 'after' ? insertIdx + 1 : insertIdx;
					remaining.splice(finalIdx, 0, ...draggedColumns);
				} else {
					// Target not found — append at end
					remaining.push(...draggedColumns);
				}
			} else {
				// Dropped on the section itself — append at end
				remaining.push(...draggedColumns);
			}

			onOrderChange(remaining);
		}

		// Reset drag state
		draggedColumns = [];
		dropTargetColumn = null;
		dropPosition = null;
		dropTargetSection = null;
	}

	function handleDragEnd() {
		draggedColumns = [];
		dropTargetColumn = null;
		dropPosition = null;
		dropTargetSection = null;
	}

	function handleDragLeave(event: DragEvent) {
		// Only clear if leaving the picker entirely
		const related = event.relatedTarget as HTMLElement | null;
		if (related && (event.currentTarget as HTMLElement).contains(related)) return;
		dropTargetColumn = null;
		dropPosition = null;
	}

	// ─── Keyboard Support ─────────────────────────────────────────────────────

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				focusedIndex = Math.min(focusedIndex + 1, allItems.length - 1);
				if (focusedIndex >= 0) {
					selectedColumns = new Set([allItems[focusedIndex].name]);
					lastClickedColumn = allItems[focusedIndex].name;
				}
				scrollToFocused();
				break;

			case 'ArrowUp':
				event.preventDefault();
				focusedIndex = Math.max(focusedIndex - 1, 0);
				if (focusedIndex >= 0 && allItems.length > 0) {
					selectedColumns = new Set([allItems[focusedIndex].name]);
					lastClickedColumn = allItems[focusedIndex].name;
				}
				scrollToFocused();
				break;

			case ' ':
				event.preventDefault();
				if (focusedIndex >= 0 && focusedIndex < allItems.length) {
					const col = allItems[focusedIndex];
					const vis = isVisible(col.name, columnVisibility);
					onVisibilityChange(col.name, !vis);
				}
				break;

			case 'a':
				if (event.ctrlKey || event.metaKey) {
					event.preventDefault();
					// Select all in the current section
					selectedColumns = new Set(allItems.map((c) => c.name));
				}
				break;

			case 'Escape':
				event.preventDefault();
				if (selectedColumns.size > 0) {
					selectedColumns = new Set();
					focusedIndex = -1;
				}
				break;
		}
	}

	function scrollToFocused() {
		tick().then(() => {
			const items = listContainer?.querySelectorAll('.gridlite-column-picker-item');
			if (items && focusedIndex >= 0 && focusedIndex < items.length) {
				items[focusedIndex].scrollIntoView({ block: 'nearest' });
			}
		});
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="gridlite-column-picker"
		onclick={(e) => e.stopPropagation()}
		onkeydown={handleKeydown}
		ondrop={handleDrop}
		ondragend={handleDragEnd}
		role="listbox"
		aria-label="Column picker"
		tabindex="-1"
	>
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
					onclick={() => { searchQuery = ''; searchInput?.focus(); }}
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
			<button type="button" onclick={() => onToggleAll(true)}>Show All</button>
			<button type="button" onclick={() => onToggleAll(false)}>Hide All</button>
			{#if selectedColumns.size > 1}
				<span class="gridlite-column-picker-selection-count">{selectedColumns.size} selected</span>
			{/if}
		</div>

		<div class="gridlite-column-picker-list" bind:this={listContainer}>
			<!-- Visible section -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="gridlite-column-picker-section"
				ondragover={(e) => handleDragOverSection(e, 'visible')}
			>
				<div class="gridlite-column-picker-section-header">
					<span>Visible</span>
					<span class="gridlite-column-picker-section-count">{totalVisible}</span>
				</div>
				{#each visibleCols as col, i (col.name)}
					{@const globalIdx = allItems.indexOf(col)}
					{@const isSelected = selectedColumns.has(col.name)}
					{@const isDragged = draggedColumns.includes(col.name)}
					{@const isDropTarget = dropTargetColumn === col.name}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="gridlite-column-picker-item"
						class:selected={isSelected}
						class:dragged={isDragged}
						class:drop-before={isDropTarget && dropPosition === 'before'}
						class:drop-after={isDropTarget && dropPosition === 'after'}
						class:focused={focusedIndex === globalIdx}
						onclick={(e) => handleItemClick(e, col.name)}
						ondragover={(e) => handleDragOver(e, col.name, 'visible')}
						ondragleave={handleDragLeave}
						role="option"
						tabindex="-1"
						aria-selected={isSelected}
					>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span
							class="gridlite-column-picker-drag-handle"
							draggable="true"
							ondragstart={(e) => handleDragStart(e, col.name)}
						>
							<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
								<circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
								<circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
								<circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
							</svg>
						</span>
						<input
							type="checkbox"
							checked={true}
							onchange={(e) => { e.stopPropagation(); onVisibilityChange(col.name, false); }}
							onclick={(e) => e.stopPropagation()}
						/>
						<span class="gridlite-column-picker-item-label">{getLabel(col)}</span>
					</div>
				{/each}
				{#if visibleCols.length === 0}
					<div class="gridlite-column-picker-empty">
						{searchQuery ? 'No matching visible columns' : 'No visible columns'}
					</div>
				{/if}
			</div>

			<!-- Hidden section -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="gridlite-column-picker-section"
				ondragover={(e) => handleDragOverSection(e, 'hidden')}
			>
				<div class="gridlite-column-picker-section-header">
					<span>Hidden</span>
					<span class="gridlite-column-picker-section-count">{totalHidden}</span>
				</div>
				{#each hiddenCols as col (col.name)}
					{@const globalIdx = allItems.indexOf(col)}
					{@const isSelected = selectedColumns.has(col.name)}
					{@const isDragged = draggedColumns.includes(col.name)}
					{@const isDropTarget = dropTargetColumn === col.name}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="gridlite-column-picker-item gridlite-column-picker-item-hidden"
						class:selected={isSelected}
						class:dragged={isDragged}
						class:drop-before={isDropTarget && dropPosition === 'before'}
						class:drop-after={isDropTarget && dropPosition === 'after'}
						class:focused={focusedIndex === globalIdx}
						onclick={(e) => handleItemClick(e, col.name)}
						ondragover={(e) => handleDragOver(e, col.name, 'hidden')}
						ondragleave={handleDragLeave}
						role="option"
						tabindex="-1"
						aria-selected={isSelected}
					>
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span
							class="gridlite-column-picker-drag-handle"
							draggable="true"
							ondragstart={(e) => handleDragStart(e, col.name)}
						>
							<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
								<circle cx="3" cy="2" r="1.2" /><circle cx="7" cy="2" r="1.2" />
								<circle cx="3" cy="7" r="1.2" /><circle cx="7" cy="7" r="1.2" />
								<circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
							</svg>
						</span>
						<input
							type="checkbox"
							checked={false}
							onchange={(e) => { e.stopPropagation(); onVisibilityChange(col.name, true); }}
							onclick={(e) => e.stopPropagation()}
						/>
						<span class="gridlite-column-picker-item-label">{getLabel(col)}</span>
					</div>
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
