/**
 * columns.ts — Pure column pipeline functions
 *
 * Extracted from GridLite.svelte reactive statements to enable
 * thorough testing of the column visibility, ordering, and
 * grouping filter logic.
 */

import type { ColumnMetadata, GroupConfig } from './types.js';

/**
 * Filter columns to only those marked visible.
 *
 * Priority:
 * 1. Explicit columnVisibility entry (user toggle)
 * 2. defaultVisibleColumns list (config)
 * 3. Default: all visible
 */
export function getVisibleColumns(
	columns: ColumnMetadata[],
	columnVisibility: Record<string, boolean>,
	defaultVisibleColumns?: string[]
): ColumnMetadata[] {
	return columns.filter((col) => {
		if (col.name in columnVisibility) {
			return columnVisibility[col.name];
		}
		if (defaultVisibleColumns) {
			return defaultVisibleColumns.includes(col.name);
		}
		return true;
	});
}

/**
 * Sort visible columns by a given order.
 *
 * Columns not in the order array are pushed to the end,
 * preserving their relative order among themselves.
 */
export function getOrderedColumns(
	visibleColumns: ColumnMetadata[],
	columnOrder: string[],
	defaultColumnOrder?: string[]
): ColumnMetadata[] {
	const order = columnOrder.length > 0 ? columnOrder : (defaultColumnOrder ?? []);
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
}

/**
 * Filter out columns used for grouping.
 *
 * In grouped view, grouped columns appear as group row headers,
 * not as regular table columns.
 */
export function getNonGroupedColumns(
	orderedColumns: ColumnMetadata[],
	grouping: GroupConfig[]
): ColumnMetadata[] {
	const validGrouping = grouping.filter((g) => g.column !== '');
	if (validGrouping.length === 0) return orderedColumns;
	return orderedColumns.filter(
		(col) => !validGrouping.some((g) => g.column === col.name)
	);
}

/**
 * Check whether a single column is visible (used by ColumnPicker and persistence).
 */
export function isColumnVisible(
	columnName: string,
	columnVisibility: Record<string, boolean>,
	defaultVisibleColumns?: string[]
): boolean {
	if (columnName in columnVisibility) {
		return columnVisibility[columnName];
	}
	if (defaultVisibleColumns) {
		return defaultVisibleColumns.includes(columnName);
	}
	return true;
}
