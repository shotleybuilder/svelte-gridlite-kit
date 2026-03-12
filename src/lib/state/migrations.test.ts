import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { runMigrations, getLatestVersion, isMigrated } from './migrations.js';

describe('runMigrations', () => {
	let db: PGlite;

	beforeEach(async () => {
		db = new PGlite();
	});

	afterEach(async () => {
		await db.close();
	});

	it('creates all config tables on first run', async () => {
		const version = await runMigrations(db);
		expect(version).toBe(getLatestVersion());

		// Verify _gridlite_meta exists and has version
		const meta = await db.query<{ value: string }>(
			`SELECT value FROM _gridlite_meta WHERE key = 'migration_version'`
		);
		expect(meta.rows).toHaveLength(1);
		expect(parseInt(meta.rows[0].value, 10)).toBe(getLatestVersion());

		// Verify _gridlite_views exists
		const views = await db.query(`SELECT * FROM _gridlite_views`);
		expect(views.rows).toEqual([]);

		// Verify _gridlite_column_state exists
		const colState = await db.query(`SELECT * FROM _gridlite_column_state`);
		expect(colState.rows).toEqual([]);
	});

	it('is idempotent — running twice has no effect', async () => {
		const v1 = await runMigrations(db);
		const v2 = await runMigrations(db);
		expect(v1).toBe(v2);

		// Tables should still exist and be empty
		const views = await db.query(`SELECT * FROM _gridlite_views`);
		expect(views.rows).toEqual([]);
	});

	it('preserves existing data across re-runs', async () => {
		await runMigrations(db);

		// Insert a view
		await db.query(
			`INSERT INTO _gridlite_views (id, grid_id, name) VALUES ($1, $2, $3)`,
			['view-1', 'grid-1', 'Test View']
		);

		// Run migrations again
		await runMigrations(db);

		// View should still be there
		const views = await db.query<{ id: string; name: string }>(
			`SELECT id, name FROM _gridlite_views`
		);
		expect(views.rows).toHaveLength(1);
		expect(views.rows[0].name).toBe('Test View');
	});

	it('creates _gridlite_views with correct columns', async () => {
		await runMigrations(db);

		// Insert a full view record
		await db.query(
			`INSERT INTO _gridlite_views
				(id, grid_id, name, description, filters, filter_logic, sorting, grouping, column_visibility, column_order, is_default)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			[
				'view-full',
				'grid-1',
				'Full View',
				'A test view',
				JSON.stringify([{ field: 'name', operator: 'equals', value: 'test' }]),
				'and',
				JSON.stringify([{ column: 'name', direction: 'asc' }]),
				JSON.stringify([]),
				JSON.stringify({ name: true, email: false }),
				JSON.stringify(['name', 'email', 'age']),
				true
			]
		);

		const result = await db.query<Record<string, unknown>>(
			`SELECT * FROM _gridlite_views WHERE id = $1`,
			['view-full']
		);
		expect(result.rows).toHaveLength(1);

		const view = result.rows[0];
		expect(view.grid_id).toBe('grid-1');
		expect(view.name).toBe('Full View');
		expect(view.description).toBe('A test view');
		expect(view.filter_logic).toBe('and');
		expect(view.is_default).toBe(true);
	});

	it('creates _gridlite_column_state with correct columns', async () => {
		await runMigrations(db);

		await db.query(
			`INSERT INTO _gridlite_column_state (grid_id, view_id, column_name, visible, width, position)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			['grid-1', 'view-1', 'name', true, 200, 0]
		);

		const result = await db.query<Record<string, unknown>>(
			`SELECT * FROM _gridlite_column_state WHERE grid_id = $1`,
			['grid-1']
		);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].column_name).toBe('name');
		expect(result.rows[0].visible).toBe(true);
		expect(result.rows[0].width).toBe(200);
		expect(result.rows[0].position).toBe(0);
	});
});

describe('isMigrated', () => {
	let db: PGlite;

	beforeEach(async () => {
		db = new PGlite();
	});

	afterEach(async () => {
		await db.close();
	});

	it('returns false before migrations', async () => {
		expect(await isMigrated(db)).toBe(false);
	});

	it('returns true after migrations', async () => {
		await runMigrations(db);
		expect(await isMigrated(db)).toBe(true);
	});
});

describe('getLatestVersion', () => {
	it('returns a positive number', () => {
		expect(getLatestVersion()).toBeGreaterThan(0);
	});
});
