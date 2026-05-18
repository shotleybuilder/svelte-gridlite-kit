import { describe, it, expect } from 'vitest';
import {
	getVisibleColumns,
	getOrderedColumns,
	getNonGroupedColumns,
	isColumnVisible
} from './columns.js';
import type { ColumnMetadata, GroupConfig } from './types.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function col(name: string, dataType: 'text' | 'number' = 'text'): ColumnMetadata {
	return { name, dataType, postgresType: dataType, nullable: true, hasDefault: false };
}

const COLUMNS_6 = [
	col('law_name'),
	col('title'),
	col('family'),
	col('making_review'),
	col('making_classification'),
	col('function')
];

function names(cols: ColumnMetadata[]): string[] {
	return cols.map((c) => c.name);
}

// ─── getVisibleColumns ───────────────────────────────────────────────────────

describe('getVisibleColumns', () => {
	it('shows all columns by default (no visibility config)', () => {
		const result = getVisibleColumns(COLUMNS_6, {});
		expect(names(result)).toEqual(names(COLUMNS_6));
	});

	it('hides columns with explicit false in columnVisibility', () => {
		const result = getVisibleColumns(COLUMNS_6, { title: false });
		expect(names(result)).not.toContain('title');
		expect(result).toHaveLength(5);
	});

	it('shows columns with explicit true in columnVisibility', () => {
		const result = getVisibleColumns(COLUMNS_6, { title: true });
		expect(names(result)).toContain('title');
	});

	it('uses defaultVisibleColumns when columnVisibility has no entry', () => {
		const result = getVisibleColumns(COLUMNS_6, {}, ['law_name', 'family', 'function']);
		expect(names(result)).toEqual(['law_name', 'family', 'function']);
	});

	it('columnVisibility overrides defaultVisibleColumns', () => {
		// title is NOT in defaultVisibleColumns, but columnVisibility says true
		const result = getVisibleColumns(COLUMNS_6, { title: true }, ['law_name', 'family']);
		expect(names(result)).toContain('title');
		expect(names(result)).toContain('law_name');
		expect(names(result)).toContain('family');
	});

	it('columnVisibility=false overrides defaultVisibleColumns', () => {
		// law_name IS in defaultVisibleColumns, but columnVisibility says false
		const result = getVisibleColumns(COLUMNS_6, { law_name: false }, ['law_name', 'family']);
		expect(names(result)).not.toContain('law_name');
		expect(names(result)).toContain('family');
	});

	it('new columns not in defaultVisibleColumns are hidden', () => {
		// Simulates adding new columns to schema after defaultVisibleColumns was set
		const defaultVisible = ['law_name', 'family', 'function'];
		const result = getVisibleColumns(COLUMNS_6, {}, defaultVisible);
		// title, making_review, making_classification should be hidden
		expect(names(result)).toEqual(['law_name', 'family', 'function']);
	});

	it('new columns not in defaultVisibleColumns can be shown via columnVisibility', () => {
		const defaultVisible = ['law_name', 'family', 'function'];
		const result = getVisibleColumns(
			COLUMNS_6,
			{ making_review: true, making_classification: true },
			defaultVisible
		);
		expect(names(result)).toContain('making_review');
		expect(names(result)).toContain('making_classification');
		expect(result).toHaveLength(5);
	});

	it('empty columns array returns empty', () => {
		expect(getVisibleColumns([], {})).toEqual([]);
	});

	it('all columns explicitly hidden returns empty', () => {
		const vis: Record<string, boolean> = {};
		for (const c of COLUMNS_6) vis[c.name] = false;
		expect(getVisibleColumns(COLUMNS_6, vis)).toEqual([]);
	});
});

// ─── getOrderedColumns ───────────────────────────────────────────────────────

describe('getOrderedColumns', () => {
	it('returns columns in original order when no order specified', () => {
		const result = getOrderedColumns(COLUMNS_6, []);
		expect(names(result)).toEqual(names(COLUMNS_6));
	});

	it('sorts columns by explicit order', () => {
		const order = ['function', 'family', 'law_name', 'title', 'making_review', 'making_classification'];
		const result = getOrderedColumns(COLUMNS_6, order);
		expect(names(result)).toEqual(order);
	});

	it('uses defaultColumnOrder when columnOrder is empty', () => {
		const defaultOrder = ['function', 'law_name', 'family', 'title', 'making_review', 'making_classification'];
		const result = getOrderedColumns(COLUMNS_6, [], defaultOrder);
		expect(names(result)).toEqual(defaultOrder);
	});

	it('columnOrder takes priority over defaultColumnOrder', () => {
		const columnOrder = ['title', 'law_name'];
		const defaultOrder = ['function', 'law_name'];
		const result = getOrderedColumns(COLUMNS_6, columnOrder, defaultOrder);
		// title and law_name come first (in that order), rest pushed to end
		expect(names(result)[0]).toBe('title');
		expect(names(result)[1]).toBe('law_name');
	});

	it('columns not in order are pushed to end', () => {
		const order = ['law_name', 'family', 'function'];
		const result = getOrderedColumns(COLUMNS_6, order);
		// First 3 should be the ordered ones
		expect(names(result).slice(0, 3)).toEqual(['law_name', 'family', 'function']);
		// Remaining should be the unordered ones (pushed to end)
		const remaining = names(result).slice(3);
		expect(remaining).toContain('title');
		expect(remaining).toContain('making_review');
		expect(remaining).toContain('making_classification');
	});

	it('columns not in order preserve relative order among themselves', () => {
		// Only order the first column — the rest should keep schema order
		const order = ['law_name'];
		const result = getOrderedColumns(COLUMNS_6, order);
		expect(names(result)[0]).toBe('law_name');
		// Remaining 5 should all be pushed to end with stable relative order
		const rest = names(result).slice(1);
		expect(rest).toEqual(['title', 'family', 'making_review', 'making_classification', 'function']);
	});

	it('all columns in order — exact reorder', () => {
		const order = ['making_classification', 'making_review', 'function', 'family', 'title', 'law_name'];
		const result = getOrderedColumns(COLUMNS_6, order);
		expect(names(result)).toEqual(order);
	});

	it('order with unknown column names ignores them', () => {
		const order = ['law_name', 'nonexistent', 'family'];
		const result = getOrderedColumns(COLUMNS_6, order);
		expect(names(result)[0]).toBe('law_name');
		expect(names(result)[1]).toBe('family');
		expect(result).toHaveLength(6); // all columns still present
	});

	it('empty visible columns returns empty', () => {
		expect(getOrderedColumns([], ['law_name'])).toEqual([]);
	});

	it('partial order — new columns added after initial setup', () => {
		// Simulate: grid was created with 3 columns, now has 6
		// Only the original 3 are in the order
		const order = ['law_name', 'family', 'function'];
		const result = getOrderedColumns(COLUMNS_6, order);
		expect(result).toHaveLength(6); // ALL columns still present
		expect(names(result).slice(0, 3)).toEqual(['law_name', 'family', 'function']);
	});
});

// ─── getNonGroupedColumns ────────────────────────────────────────────────────

describe('getNonGroupedColumns', () => {
	it('returns all columns when no grouping', () => {
		const result = getNonGroupedColumns(COLUMNS_6, []);
		expect(names(result)).toEqual(names(COLUMNS_6));
	});

	it('excludes grouped columns', () => {
		const grouping: GroupConfig[] = [{ column: 'family', aggregations: [] }];
		const result = getNonGroupedColumns(COLUMNS_6, grouping);
		expect(names(result)).not.toContain('family');
		expect(result).toHaveLength(5);
	});

	it('excludes multiple grouped columns', () => {
		const grouping: GroupConfig[] = [
			{ column: 'family', aggregations: [] },
			{ column: 'function', aggregations: [] }
		];
		const result = getNonGroupedColumns(COLUMNS_6, grouping);
		expect(names(result)).not.toContain('family');
		expect(names(result)).not.toContain('function');
		expect(result).toHaveLength(4);
	});

	it('ignores empty group entries', () => {
		const grouping: GroupConfig[] = [
			{ column: '', aggregations: [] },
			{ column: 'family', aggregations: [] }
		];
		const result = getNonGroupedColumns(COLUMNS_6, grouping);
		expect(names(result)).not.toContain('family');
		expect(result).toHaveLength(5);
	});

	it('group column not in columns has no effect', () => {
		const grouping: GroupConfig[] = [{ column: 'nonexistent', aggregations: [] }];
		const result = getNonGroupedColumns(COLUMNS_6, grouping);
		expect(result).toHaveLength(6);
	});
});

// ─── isColumnVisible ─────────────────────────────────────────────────────────

describe('isColumnVisible', () => {
	it('returns true by default', () => {
		expect(isColumnVisible('law_name', {})).toBe(true);
	});

	it('returns explicit columnVisibility value', () => {
		expect(isColumnVisible('law_name', { law_name: false })).toBe(false);
		expect(isColumnVisible('law_name', { law_name: true })).toBe(true);
	});

	it('falls back to defaultVisibleColumns', () => {
		expect(isColumnVisible('law_name', {}, ['law_name', 'title'])).toBe(true);
		expect(isColumnVisible('family', {}, ['law_name', 'title'])).toBe(false);
	});

	it('columnVisibility overrides defaultVisibleColumns', () => {
		expect(isColumnVisible('family', { family: true }, ['law_name'])).toBe(true);
		expect(isColumnVisible('law_name', { law_name: false }, ['law_name'])).toBe(false);
	});
});

// ─── Full Pipeline (integration-style) ───────────────────────────────────────

describe('full column pipeline', () => {
	it('issue #33: columns visible in picker but not rendering — fresh state', () => {
		// No persisted state, no defaultVisibleColumns
		const visible = getVisibleColumns(COLUMNS_6, {});
		const ordered = getOrderedColumns(visible, []);
		const grouping: GroupConfig[] = [
			{ column: 'family', aggregations: [] },
			{ column: 'function', aggregations: [] }
		];
		const nonGrouped = getNonGroupedColumns(ordered, grouping);

		// All 6 should be visible
		expect(names(visible)).toEqual(names(COLUMNS_6));
		// All 6 ordered (original order)
		expect(names(ordered)).toEqual(names(COLUMNS_6));
		// 4 non-grouped (family + function excluded)
		expect(nonGrouped).toHaveLength(4);
		expect(names(nonGrouped)).toContain('law_name');
		expect(names(nonGrouped)).toContain('title');
		expect(names(nonGrouped)).toContain('making_review');
		expect(names(nonGrouped)).toContain('making_classification');
	});

	it('issue #33: columns with defaultVisibleColumns subset', () => {
		// If consuming app sets defaultVisibleColumns to only 3
		const defaultVisible = ['law_name', 'family', 'function'];
		const visible = getVisibleColumns(COLUMNS_6, {}, defaultVisible);
		const ordered = getOrderedColumns(visible, []);

		// Only 3 visible — title, making_review, making_classification hidden
		expect(names(visible)).toEqual(['law_name', 'family', 'function']);
		// This matches the bug screenshot! But the ColumnPicker would also show them as hidden
	});

	it('issue #33: defaultVisibleColumns blocks new columns even when user thinks they are visible', () => {
		// User added making_review and making_classification to config.columns
		// but forgot to also add them to defaultVisibleColumns
		const defaultVisible = ['law_name', 'title', 'family', 'function'];
		const visible = getVisibleColumns(COLUMNS_6, {}, defaultVisible);

		// making_review and making_classification are NOT visible
		expect(names(visible)).not.toContain('making_review');
		expect(names(visible)).not.toContain('making_classification');
		expect(visible).toHaveLength(4);
	});

	it('issue #33: ColumnConfig.visible has NO effect on rendering pipeline', () => {
		// The ColumnConfig type has a `visible` property, but it is never used
		// by getVisibleColumns. If a developer sets it expecting it to work,
		// it silently does nothing.
		const visible = getVisibleColumns(COLUMNS_6, {}, ['law_name']);
		// Only law_name visible, regardless of any ColumnConfig.visible settings
		expect(names(visible)).toEqual(['law_name']);
	});

	it('grouped view with partial columnOrder — all non-grouped columns still render', () => {
		// Order only has original 3 columns, 3 new ones were added later
		const order = ['law_name', 'family', 'function'];
		const visible = getVisibleColumns(COLUMNS_6, {});
		const ordered = getOrderedColumns(visible, order);
		const grouping: GroupConfig[] = [{ column: 'family', aggregations: [] }];
		const nonGrouped = getNonGroupedColumns(ordered, grouping);

		// All 6 visible
		expect(visible).toHaveLength(6);
		// All 6 ordered (3 ordered + 3 at end)
		expect(ordered).toHaveLength(6);
		// 5 non-grouped (family excluded)
		expect(nonGrouped).toHaveLength(5);
		expect(names(nonGrouped)).toContain('title');
		expect(names(nonGrouped)).toContain('making_review');
		expect(names(nonGrouped)).toContain('making_classification');
	});

	it('ColumnPicker isVisible agrees with getVisibleColumns for all columns', () => {
		const defaultVisible = ['law_name', 'family', 'function'];
		const vis = { making_review: true };

		const visible = getVisibleColumns(COLUMNS_6, vis, defaultVisible);
		for (const col of COLUMNS_6) {
			const pickerSaysVisible = isColumnVisible(col.name, vis, defaultVisible);
			const inVisibleList = visible.some((c) => c.name === col.name);
			expect(pickerSaysVisible).toBe(inVisibleList);
		}
	});
});
