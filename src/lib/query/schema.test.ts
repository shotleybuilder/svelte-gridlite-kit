import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { mapPostgresType, introspectTable, getColumnNames } from './schema.js';

// ─── mapPostgresType (pure function, no DB needed) ─────────────────────────

describe('mapPostgresType', () => {
	it('maps numeric types', () => {
		expect(mapPostgresType('integer')).toBe('number');
		expect(mapPostgresType('bigint')).toBe('number');
		expect(mapPostgresType('smallint')).toBe('number');
		expect(mapPostgresType('numeric')).toBe('number');
		expect(mapPostgresType('decimal')).toBe('number');
		expect(mapPostgresType('real')).toBe('number');
		expect(mapPostgresType('double precision')).toBe('number');
		expect(mapPostgresType('serial')).toBe('number');
		expect(mapPostgresType('bigserial')).toBe('number');
		expect(mapPostgresType('smallserial')).toBe('number');
		expect(mapPostgresType('money')).toBe('number');
	});

	it('maps date/time types', () => {
		expect(mapPostgresType('date')).toBe('date');
		expect(mapPostgresType('timestamp without time zone')).toBe('date');
		expect(mapPostgresType('timestamp with time zone')).toBe('date');
		expect(mapPostgresType('time without time zone')).toBe('date');
		expect(mapPostgresType('time with time zone')).toBe('date');
		expect(mapPostgresType('interval')).toBe('date');
	});

	it('maps boolean', () => {
		expect(mapPostgresType('boolean')).toBe('boolean');
	});

	it('maps text types', () => {
		expect(mapPostgresType('character varying')).toBe('text');
		expect(mapPostgresType('character')).toBe('text');
		expect(mapPostgresType('text')).toBe('text');
		expect(mapPostgresType('uuid')).toBe('text');
		expect(mapPostgresType('json')).toBe('text');
		expect(mapPostgresType('jsonb')).toBe('text');
	});

	it('is case-insensitive', () => {
		expect(mapPostgresType('INTEGER')).toBe('number');
		expect(mapPostgresType('Boolean')).toBe('boolean');
		expect(mapPostgresType('DATE')).toBe('date');
	});
});

// ─── introspectTable (requires PGLite) ──────────────────────────────────────

describe('introspectTable', () => {
	let db: PGlite;

	beforeAll(async () => {
		db = new PGlite();
		await db.exec(`
			CREATE TABLE employees (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				email VARCHAR(255),
				salary NUMERIC(10, 2),
				hire_date DATE,
				active BOOLEAN DEFAULT true,
				department VARCHAR(100),
				notes TEXT
			)
		`);
	});

	afterAll(async () => {
		await db.close();
	});

	it('returns all columns in ordinal order', async () => {
		const columns = await introspectTable(db, 'employees');
		expect(columns).toHaveLength(8);
		expect(columns.map((c) => c.name)).toEqual([
			'id',
			'name',
			'email',
			'salary',
			'hire_date',
			'active',
			'department',
			'notes'
		]);
	});

	it('maps data types correctly', async () => {
		const columns = await introspectTable(db, 'employees');
		const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

		expect(byName.id.dataType).toBe('number');
		expect(byName.name.dataType).toBe('text');
		expect(byName.email.dataType).toBe('text');
		expect(byName.salary.dataType).toBe('number');
		expect(byName.hire_date.dataType).toBe('date');
		expect(byName.active.dataType).toBe('boolean');
		expect(byName.department.dataType).toBe('text');
		expect(byName.notes.dataType).toBe('text');
	});

	it('detects nullable columns', async () => {
		const columns = await introspectTable(db, 'employees');
		const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

		// NOT NULL constraint
		expect(byName.name.nullable).toBe(false);
		// PRIMARY KEY implies NOT NULL
		expect(byName.id.nullable).toBe(false);
		// No constraint — nullable
		expect(byName.email.nullable).toBe(true);
		expect(byName.salary.nullable).toBe(true);
		expect(byName.notes.nullable).toBe(true);
	});

	it('detects columns with defaults', async () => {
		const columns = await introspectTable(db, 'employees');
		const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

		// SERIAL has a default (nextval)
		expect(byName.id.hasDefault).toBe(true);
		// DEFAULT true
		expect(byName.active.hasDefault).toBe(true);
		// No default
		expect(byName.name.hasDefault).toBe(false);
		expect(byName.email.hasDefault).toBe(false);
	});

	it('preserves postgres type string', async () => {
		const columns = await introspectTable(db, 'employees');
		const byName = Object.fromEntries(columns.map((c) => [c.name, c]));

		expect(byName.id.postgresType).toBe('integer');
		expect(byName.name.postgresType).toBe('text');
		expect(byName.salary.postgresType).toBe('numeric');
		expect(byName.hire_date.postgresType).toBe('date');
		expect(byName.active.postgresType).toBe('boolean');
	});

	it('returns empty array for non-existent table', async () => {
		const columns = await introspectTable(db, 'nonexistent_table');
		expect(columns).toEqual([]);
	});
});

// ─── getColumnNames ─────────────────────────────────────────────────────────

describe('getColumnNames', () => {
	let db: PGlite;

	beforeAll(async () => {
		db = new PGlite();
		await db.exec(`
			CREATE TABLE products (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				price NUMERIC(10, 2)
			)
		`);
	});

	afterAll(async () => {
		await db.close();
	});

	it('returns column names as string array', async () => {
		const names = await getColumnNames(db, 'products');
		expect(names).toEqual(['id', 'name', 'price']);
	});

	it('returns empty array for non-existent table', async () => {
		const names = await getColumnNames(db, 'nonexistent');
		expect(names).toEqual([]);
	});
});
