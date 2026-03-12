import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runMigrations } from './migrations.js';
import {
	saveView,
	loadView,
	loadViews,
	loadDefaultView,
	setDefaultView,
	deleteView,
	saveColumnState,
	loadColumnState
} from './views.js';
import type { ViewPreset } from '../types.js';

describe('view CRUD', () => {
	let db: PGlite;

	beforeEach(async () => {
		db = new PGlite();
		await runMigrations(db);
	});

	afterEach(async () => {
		await db.close();
	});

	it('saves and loads a view', async () => {
		const view: ViewPreset = {
			id: 'view-1',
			name: 'Active Users',
			description: 'Shows only active users',
			filters: [{ id: 'f1', field: 'active', operator: 'equals', value: true }],
			filterLogic: 'and',
			sorting: [{ column: 'name', direction: 'asc' }],
			grouping: [],
			columnVisibility: { name: true, email: true, active: false },
			columnOrder: ['name', 'email']
		};

		await saveView(db, 'grid-1', view);
		const loaded = await loadView(db, 'view-1');

		expect(loaded).not.toBeNull();
		expect(loaded!.id).toBe('view-1');
		expect(loaded!.name).toBe('Active Users');
		expect(loaded!.description).toBe('Shows only active users');
		expect(loaded!.filters).toHaveLength(1);
		expect(loaded!.filters![0].field).toBe('active');
		expect(loaded!.filterLogic).toBe('and');
		expect(loaded!.sorting).toHaveLength(1);
		expect(loaded!.sorting![0].column).toBe('name');
		expect(loaded!.columnVisibility).toEqual({ name: true, email: true, active: false });
		expect(loaded!.columnOrder).toEqual(['name', 'email']);
	});

	it('upserts on save (updates existing)', async () => {
		await saveView(db, 'grid-1', {
			id: 'view-1',
			name: 'Original'
		});

		await saveView(db, 'grid-1', {
			id: 'view-1',
			name: 'Updated',
			description: 'Now with description'
		});

		const loaded = await loadView(db, 'view-1');
		expect(loaded!.name).toBe('Updated');
		expect(loaded!.description).toBe('Now with description');

		// Should still be only one row
		const all = await loadViews(db, 'grid-1');
		expect(all).toHaveLength(1);
	});

	it('loads all views for a grid, sorted by name', async () => {
		await saveView(db, 'grid-1', { id: 'v-z', name: 'Zebra View' });
		await saveView(db, 'grid-1', { id: 'v-a', name: 'Alpha View' });
		await saveView(db, 'grid-2', { id: 'v-other', name: 'Other Grid' });

		const views = await loadViews(db, 'grid-1');
		expect(views).toHaveLength(2);
		expect(views[0].name).toBe('Alpha View');
		expect(views[1].name).toBe('Zebra View');
	});

	it('returns null for non-existent view', async () => {
		const loaded = await loadView(db, 'nonexistent');
		expect(loaded).toBeNull();
	});

	it('returns empty array for grid with no views', async () => {
		const views = await loadViews(db, 'nonexistent-grid');
		expect(views).toEqual([]);
	});

	it('deletes a view', async () => {
		await saveView(db, 'grid-1', { id: 'view-1', name: 'Delete Me' });
		await deleteView(db, 'view-1');

		const loaded = await loadView(db, 'view-1');
		expect(loaded).toBeNull();
	});

	it('delete also removes associated column state', async () => {
		await saveView(db, 'grid-1', { id: 'view-1', name: 'Test' });
		await saveColumnState(db, 'grid-1', [
			{ name: 'col_a', visible: true, position: 0 }
		], 'view-1');

		await deleteView(db, 'view-1');

		const colState = await loadColumnState(db, 'grid-1', 'view-1');
		expect(colState).toEqual([]);
	});
});

describe('default view', () => {
	let db: PGlite;

	beforeEach(async () => {
		db = new PGlite();
		await runMigrations(db);
	});

	afterEach(async () => {
		await db.close();
	});

	it('returns null when no default is set', async () => {
		await saveView(db, 'grid-1', { id: 'v1', name: 'View 1' });
		const def = await loadDefaultView(db, 'grid-1');
		expect(def).toBeNull();
	});

	it('sets and loads a default view', async () => {
		await saveView(db, 'grid-1', { id: 'v1', name: 'View 1' });
		await saveView(db, 'grid-1', { id: 'v2', name: 'View 2' });

		await setDefaultView(db, 'grid-1', 'v2');
		const def = await loadDefaultView(db, 'grid-1');

		expect(def).not.toBeNull();
		expect(def!.id).toBe('v2');
		expect(def!.name).toBe('View 2');
	});

	it('switching default clears the previous one', async () => {
		await saveView(db, 'grid-1', { id: 'v1', name: 'View 1' });
		await saveView(db, 'grid-1', { id: 'v2', name: 'View 2' });

		await setDefaultView(db, 'grid-1', 'v1');
		await setDefaultView(db, 'grid-1', 'v2');

		const def = await loadDefaultView(db, 'grid-1');
		expect(def!.id).toBe('v2');

		// Only one default should exist
		const result = await db.query<{ cnt: string }>(
			`SELECT COUNT(*) as cnt FROM _gridlite_views WHERE grid_id = $1 AND is_default = true`,
			['grid-1']
		);
		expect(parseInt(result.rows[0].cnt, 10)).toBe(1);
	});
});

describe('column state CRUD', () => {
	let db: PGlite;

	beforeEach(async () => {
		db = new PGlite();
		await runMigrations(db);
	});

	afterEach(async () => {
		await db.close();
	});

	it('saves and loads column state (default view)', async () => {
		await saveColumnState(db, 'grid-1', [
			{ name: 'name', visible: true, width: 200, position: 0 },
			{ name: 'email', visible: true, width: 300, position: 1 },
			{ name: 'age', visible: false, position: 2 }
		]);

		const state = await loadColumnState(db, 'grid-1');
		expect(state).toHaveLength(3);
		expect(state[0]).toEqual({ name: 'name', visible: true, width: 200, position: 0 });
		expect(state[1]).toEqual({ name: 'email', visible: true, width: 300, position: 1 });
		expect(state[2]).toEqual({ name: 'age', visible: false, width: null, position: 2 });
	});

	it('saves column state scoped to a view', async () => {
		await saveColumnState(db, 'grid-1', [
			{ name: 'name', visible: true, position: 0 }
		], 'view-a');

		await saveColumnState(db, 'grid-1', [
			{ name: 'name', visible: false, position: 0 }
		], 'view-b');

		const stateA = await loadColumnState(db, 'grid-1', 'view-a');
		const stateB = await loadColumnState(db, 'grid-1', 'view-b');

		expect(stateA[0].visible).toBe(true);
		expect(stateB[0].visible).toBe(false);
	});

	it('replaces all state on re-save', async () => {
		await saveColumnState(db, 'grid-1', [
			{ name: 'col_a', visible: true, position: 0 },
			{ name: 'col_b', visible: true, position: 1 }
		]);

		// Save with only one column — col_b should be gone
		await saveColumnState(db, 'grid-1', [
			{ name: 'col_a', visible: false, position: 0 }
		]);

		const state = await loadColumnState(db, 'grid-1');
		expect(state).toHaveLength(1);
		expect(state[0].name).toBe('col_a');
		expect(state[0].visible).toBe(false);
	});

	it('returns empty array for no saved state', async () => {
		const state = await loadColumnState(db, 'nonexistent');
		expect(state).toEqual([]);
	});
});
