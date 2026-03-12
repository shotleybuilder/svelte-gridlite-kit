import { describe, it, expect } from 'vitest';
import {
	quoteIdentifier,
	buildWhereClause,
	buildOrderByClause,
	buildGroupByClause,
	buildPaginationClause,
	buildQuery,
	buildCountQuery
} from './builder.js';
import type { FilterCondition, SortConfig, GroupConfig } from '../types.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

function fc(
	field: string,
	operator: FilterCondition['operator'],
	value: unknown = ''
): FilterCondition {
	return { id: `test-${field}-${operator}`, field, operator, value };
}

// ─── quoteIdentifier ────────────────────────────────────────────────────────

describe('quoteIdentifier', () => {
	it('quotes a valid identifier', () => {
		expect(quoteIdentifier('name')).toBe('"name"');
		expect(quoteIdentifier('user_id')).toBe('"user_id"');
		expect(quoteIdentifier('_private')).toBe('"_private"');
		expect(quoteIdentifier('Col1')).toBe('"Col1"');
	});

	it('rejects invalid identifiers', () => {
		expect(() => quoteIdentifier('')).toThrow('Invalid column name');
		expect(() => quoteIdentifier('1bad')).toThrow('Invalid column name');
		expect(() => quoteIdentifier('name; DROP TABLE')).toThrow('Invalid column name');
		expect(() => quoteIdentifier('col"umn')).toThrow('Invalid column name');
		expect(() => quoteIdentifier("col'umn")).toThrow('Invalid column name');
		expect(() => quoteIdentifier('col name')).toThrow('Invalid column name');
		expect(() => quoteIdentifier('col-name')).toThrow('Invalid column name');
	});

	it('rejects columns not in allowlist', () => {
		const allowed = ['name', 'age'];
		expect(quoteIdentifier('name', allowed)).toBe('"name"');
		expect(() => quoteIdentifier('email', allowed)).toThrow('Column not found');
	});
});

// ─── buildWhereClause — String operators ────────────────────────────────────

describe('buildWhereClause — string operators', () => {
	it('equals', () => {
		const result = buildWhereClause([fc('name', 'equals', 'Alice')]);
		expect(result.sql).toBe('WHERE "name" = $1');
		expect(result.params).toEqual(['Alice']);
	});

	it('not_equals', () => {
		const result = buildWhereClause([fc('name', 'not_equals', 'Bob')]);
		expect(result.sql).toBe('WHERE "name" != $1');
		expect(result.params).toEqual(['Bob']);
	});

	it('contains (ILIKE)', () => {
		const result = buildWhereClause([fc('name', 'contains', 'ali')]);
		expect(result.sql).toBe(`WHERE "name" ILIKE '%' || $1 || '%'`);
		expect(result.params).toEqual(['ali']);
	});

	it('not_contains', () => {
		const result = buildWhereClause([fc('name', 'not_contains', 'test')]);
		expect(result.sql).toBe(`WHERE "name" NOT ILIKE '%' || $1 || '%'`);
		expect(result.params).toEqual(['test']);
	});

	it('starts_with', () => {
		const result = buildWhereClause([fc('name', 'starts_with', 'A')]);
		expect(result.sql).toBe(`WHERE "name" ILIKE $1 || '%'`);
		expect(result.params).toEqual(['A']);
	});

	it('ends_with', () => {
		const result = buildWhereClause([fc('name', 'ends_with', 'son')]);
		expect(result.sql).toBe(`WHERE "name" ILIKE '%' || $1`);
		expect(result.params).toEqual(['son']);
	});

	it('is_empty (no params)', () => {
		const result = buildWhereClause([fc('name', 'is_empty')]);
		expect(result.sql).toBe(`WHERE ("name" IS NULL OR "name" = '')`);
		expect(result.params).toEqual([]);
	});

	it('is_not_empty (no params)', () => {
		const result = buildWhereClause([fc('name', 'is_not_empty')]);
		expect(result.sql).toBe(`WHERE ("name" IS NOT NULL AND "name" != '')`);
		expect(result.params).toEqual([]);
	});
});

// ─── buildWhereClause — Numeric operators ───────────────────────────────────

describe('buildWhereClause — numeric operators', () => {
	it('greater_than', () => {
		const result = buildWhereClause([fc('age', 'greater_than', 30)]);
		expect(result.sql).toBe('WHERE "age" > $1');
		expect(result.params).toEqual([30]);
	});

	it('less_than', () => {
		const result = buildWhereClause([fc('age', 'less_than', 18)]);
		expect(result.sql).toBe('WHERE "age" < $1');
		expect(result.params).toEqual([18]);
	});

	it('greater_or_equal', () => {
		const result = buildWhereClause([fc('age', 'greater_or_equal', 21)]);
		expect(result.sql).toBe('WHERE "age" >= $1');
		expect(result.params).toEqual([21]);
	});

	it('less_or_equal', () => {
		const result = buildWhereClause([fc('age', 'less_or_equal', 65)]);
		expect(result.sql).toBe('WHERE "age" <= $1');
		expect(result.params).toEqual([65]);
	});
});

// ─── buildWhereClause — Date operators ──────────────────────────────────────

describe('buildWhereClause — date operators', () => {
	it('is_before', () => {
		const result = buildWhereClause([fc('created_at', 'is_before', '2024-01-01')]);
		expect(result.sql).toBe('WHERE "created_at" < $1');
		expect(result.params).toEqual(['2024-01-01']);
	});

	it('is_after', () => {
		const result = buildWhereClause([fc('created_at', 'is_after', '2024-06-15')]);
		expect(result.sql).toBe('WHERE "created_at" > $1');
		expect(result.params).toEqual(['2024-06-15']);
	});
});

// ─── buildWhereClause — Logic and edge cases ────────────────────────────────

describe('buildWhereClause — compound and edge cases', () => {
	it('returns empty for no conditions', () => {
		const result = buildWhereClause([]);
		expect(result.sql).toBe('');
		expect(result.params).toEqual([]);
	});

	it('skips conditions with empty value (except is_empty/is_not_empty)', () => {
		const result = buildWhereClause([
			fc('name', 'equals', ''),
			fc('name', 'contains', null),
			fc('name', 'is_empty')
		]);
		expect(result.sql).toBe(`WHERE ("name" IS NULL OR "name" = '')`);
		expect(result.params).toEqual([]);
	});

	it('AND logic (default)', () => {
		const result = buildWhereClause([
			fc('name', 'equals', 'Alice'),
			fc('age', 'greater_than', 25)
		]);
		expect(result.sql).toBe('WHERE "name" = $1 AND "age" > $2');
		expect(result.params).toEqual(['Alice', 25]);
	});

	it('OR logic', () => {
		const result = buildWhereClause(
			[fc('name', 'equals', 'Alice'), fc('name', 'equals', 'Bob')],
			'or'
		);
		expect(result.sql).toBe('WHERE "name" = $1 OR "name" = $2');
		expect(result.params).toEqual(['Alice', 'Bob']);
	});

	it('paramOffset shifts parameter indices', () => {
		const result = buildWhereClause([fc('name', 'equals', 'Alice')], 'and', 3);
		expect(result.sql).toBe('WHERE "name" = $4');
		expect(result.params).toEqual(['Alice']);
	});

	it('mixed param and no-param conditions index correctly', () => {
		const result = buildWhereClause([
			fc('email', 'is_not_empty'),
			fc('name', 'contains', 'test'),
			fc('age', 'greater_than', 18)
		]);
		// is_not_empty uses no params, so next starts at $1
		expect(result.sql).toBe(
			`WHERE ("email" IS NOT NULL AND "email" != '') AND "name" ILIKE '%' || $1 || '%' AND "age" > $2`
		);
		expect(result.params).toEqual(['test', 18]);
	});

	it('validates column names against allowlist', () => {
		const allowed = ['name', 'age'];
		expect(() =>
			buildWhereClause([fc('email', 'equals', 'x')], 'and', 0, allowed)
		).toThrow('Column not found');

		// Valid column works
		const result = buildWhereClause([fc('name', 'equals', 'x')], 'and', 0, allowed);
		expect(result.sql).toBe('WHERE "name" = $1');
	});
});

// ─── SQL Injection Prevention ───────────────────────────────────────────────

describe('SQL injection prevention', () => {
	it('rejects SQL injection in column name', () => {
		expect(() =>
			buildWhereClause([fc('name; DROP TABLE users--', 'equals', 'x')])
		).toThrow('Invalid column name');
	});

	it('rejects SQL injection via quoted identifier', () => {
		expect(() =>
			buildWhereClause([fc('name"--', 'equals', 'x')])
		).toThrow('Invalid column name');
	});

	it('parameterizes values — never interpolated', () => {
		const malicious = "'; DROP TABLE users;--";
		const result = buildWhereClause([fc('name', 'equals', malicious)]);
		// Value is in params, not in SQL string
		expect(result.sql).toBe('WHERE "name" = $1');
		expect(result.params).toEqual([malicious]);
		expect(result.sql).not.toContain(malicious);
	});

	it('rejects table name injection in buildQuery', () => {
		expect(() => buildQuery({ table: 'users; DROP TABLE x' })).toThrow('Invalid column name');
	});
});

// ─── buildOrderByClause ─────────────────────────────────────────────────────

describe('buildOrderByClause', () => {
	it('returns empty for no sorting', () => {
		expect(buildOrderByClause([])).toBe('');
	});

	it('single column ASC', () => {
		const sorting: SortConfig[] = [{ column: 'name', direction: 'asc' }];
		expect(buildOrderByClause(sorting)).toBe('ORDER BY "name" ASC');
	});

	it('single column DESC', () => {
		const sorting: SortConfig[] = [{ column: 'age', direction: 'desc' }];
		expect(buildOrderByClause(sorting)).toBe('ORDER BY "age" DESC');
	});

	it('multi-column sort', () => {
		const sorting: SortConfig[] = [
			{ column: 'last_name', direction: 'asc' },
			{ column: 'first_name', direction: 'asc' },
			{ column: 'age', direction: 'desc' }
		];
		expect(buildOrderByClause(sorting)).toBe(
			'ORDER BY "last_name" ASC, "first_name" ASC, "age" DESC'
		);
	});

	it('validates column names', () => {
		const sorting: SortConfig[] = [{ column: 'bad col', direction: 'asc' }];
		expect(() => buildOrderByClause(sorting)).toThrow('Invalid column name');
	});

	it('validates against allowlist', () => {
		const sorting: SortConfig[] = [{ column: 'email', direction: 'asc' }];
		expect(() => buildOrderByClause(sorting, ['name', 'age'])).toThrow('Column not found');
	});
});

// ─── buildGroupByClause ─────────────────────────────────────────────────────

describe('buildGroupByClause', () => {
	it('returns SELECT * with no GROUP BY for empty grouping', () => {
		const result = buildGroupByClause([]);
		expect(result.selectColumns).toBe('*');
		expect(result.groupBy).toBe('');
	});

	it('single group column with default COUNT(*)', () => {
		const grouping: GroupConfig[] = [{ column: 'department' }];
		const result = buildGroupByClause(grouping);
		expect(result.groupBy).toBe('GROUP BY "department"');
		expect(result.selectColumns).toContain('"department"');
		expect(result.selectColumns).toContain('COUNT(*) AS "_count"');
	});

	it('group with aggregations', () => {
		const grouping: GroupConfig[] = [
			{
				column: 'department',
				aggregations: [
					{ column: 'salary', function: 'avg', alias: 'avg_salary' },
					{ column: 'salary', function: 'sum' }
				]
			}
		];
		const result = buildGroupByClause(grouping);
		expect(result.groupBy).toBe('GROUP BY "department"');
		expect(result.selectColumns).toContain('AVG("salary") AS "avg_salary"');
		expect(result.selectColumns).toContain('SUM("salary") AS "sum_salary"');
		expect(result.selectColumns).toContain('COUNT(*) AS "_count"');
	});

	it('rejects invalid aggregate functions', () => {
		const grouping: GroupConfig[] = [
			{
				column: 'department',
				aggregations: [
					{ column: 'salary', function: 'EVIL' as any }
				]
			}
		];
		expect(() => buildGroupByClause(grouping)).toThrow('Invalid aggregate function');
	});

	it('validates column names', () => {
		const grouping: GroupConfig[] = [{ column: 'bad col' }];
		expect(() => buildGroupByClause(grouping)).toThrow('Invalid column name');
	});
});

// ─── buildPaginationClause ──────────────────────────────────────────────────

describe('buildPaginationClause', () => {
	it('page 0', () => {
		expect(buildPaginationClause(0, 25)).toBe('LIMIT 25 OFFSET 0');
	});

	it('page 3 with pageSize 10', () => {
		expect(buildPaginationClause(3, 10)).toBe('LIMIT 10 OFFSET 30');
	});

	it('rejects negative pageSize', () => {
		expect(() => buildPaginationClause(0, -1)).toThrow('pageSize must be positive');
	});

	it('rejects zero pageSize', () => {
		expect(() => buildPaginationClause(0, 0)).toThrow('pageSize must be positive');
	});

	it('rejects negative page', () => {
		expect(() => buildPaginationClause(-1, 10)).toThrow('page must be non-negative');
	});
});

// ─── buildQuery — full query composition ────────────────────────────────────

describe('buildQuery', () => {
	it('simple SELECT * FROM table', () => {
		const result = buildQuery({ table: 'users' });
		expect(result.sql).toBe('SELECT * FROM "users"');
		expect(result.params).toEqual([]);
	});

	it('with filters', () => {
		const result = buildQuery({
			table: 'users',
			filters: [fc('name', 'equals', 'Alice')],
		});
		expect(result.sql).toBe('SELECT * FROM "users" WHERE "name" = $1');
		expect(result.params).toEqual(['Alice']);
	});

	it('with sorting', () => {
		const result = buildQuery({
			table: 'users',
			sorting: [{ column: 'name', direction: 'asc' }]
		});
		expect(result.sql).toBe('SELECT * FROM "users" ORDER BY "name" ASC');
	});

	it('with pagination', () => {
		const result = buildQuery({
			table: 'users',
			page: 2,
			pageSize: 10
		});
		expect(result.sql).toBe('SELECT * FROM "users" LIMIT 10 OFFSET 20');
	});

	it('with grouping', () => {
		const result = buildQuery({
			table: 'orders',
			grouping: [{ column: 'status' }]
		});
		expect(result.sql).toContain('GROUP BY "status"');
		expect(result.sql).toContain('COUNT(*) AS "_count"');
		expect(result.sql).not.toContain('SELECT *');
	});

	it('all clauses composed together', () => {
		const result = buildQuery({
			table: 'users',
			filters: [fc('active', 'equals', true)],
			sorting: [{ column: 'name', direction: 'asc' }],
			page: 0,
			pageSize: 25
		});
		expect(result.sql).toBe(
			'SELECT * FROM "users" WHERE "active" = $1 ORDER BY "name" ASC LIMIT 25 OFFSET 0'
		);
		expect(result.params).toEqual([true]);
	});
});

// ─── buildCountQuery ────────────────────────────────────────────────────────

describe('buildCountQuery', () => {
	it('simple count', () => {
		const result = buildCountQuery({ table: 'users' });
		expect(result.sql).toBe('SELECT COUNT(*) AS "total" FROM "users"');
		expect(result.params).toEqual([]);
	});

	it('count with filters', () => {
		const result = buildCountQuery({
			table: 'users',
			filters: [fc('active', 'equals', true)]
		});
		expect(result.sql).toBe('SELECT COUNT(*) AS "total" FROM "users" WHERE "active" = $1');
		expect(result.params).toEqual([true]);
	});

	it('count ignores sorting and pagination', () => {
		const result = buildCountQuery({
			table: 'users',
			sorting: [{ column: 'name', direction: 'asc' }],
			page: 5,
			pageSize: 10
		});
		expect(result.sql).toBe('SELECT COUNT(*) AS "total" FROM "users"');
		expect(result.sql).not.toContain('ORDER BY');
		expect(result.sql).not.toContain('LIMIT');
	});
});
