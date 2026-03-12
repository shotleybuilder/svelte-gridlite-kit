/**
 * Schema Introspection for GridLite
 *
 * Queries information_schema.columns to discover column names, types,
 * and nullability for a given table. Maps Postgres data types to
 * GridLite's ColumnDataType for filter operator selection and UI rendering.
 */

import type { PGlite } from '@electric-sql/pglite';
import type { ColumnDataType, ColumnMetadata } from '../types.js';

// ─── Postgres Type → ColumnDataType Mapping ─────────────────────────────────

/**
 * Map a Postgres data_type string (from information_schema.columns)
 * to a GridLite ColumnDataType.
 */
export function mapPostgresType(postgresType: string): ColumnDataType {
	const t = postgresType.toLowerCase();

	// Numeric types
	if (
		t === 'integer' ||
		t === 'bigint' ||
		t === 'smallint' ||
		t === 'numeric' ||
		t === 'decimal' ||
		t === 'real' ||
		t === 'double precision' ||
		t === 'serial' ||
		t === 'bigserial' ||
		t === 'smallserial' ||
		t === 'money'
	) {
		return 'number';
	}

	// Date/time types
	if (
		t === 'date' ||
		t === 'timestamp without time zone' ||
		t === 'timestamp with time zone' ||
		t === 'time without time zone' ||
		t === 'time with time zone' ||
		t === 'interval'
	) {
		return 'date';
	}

	// Boolean
	if (t === 'boolean') {
		return 'boolean';
	}

	// Everything else is text (varchar, char, text, json, jsonb, uuid, etc.)
	return 'text';
}

// ─── Schema Introspection ───────────────────────────────────────────────────

interface InformationSchemaColumn {
	column_name: string;
	data_type: string;
	is_nullable: string;
	column_default: string | null;
}

/**
 * Introspect a table's schema using information_schema.columns.
 *
 * Returns an array of ColumnMetadata in column ordinal position order.
 * The table name is parameterized to prevent SQL injection.
 *
 * @param db - PGLite instance
 * @param tableName - The table to introspect
 * @param schema - The schema to search (defaults to 'public')
 */
export async function introspectTable(
	db: PGlite,
	tableName: string,
	schema: string = 'public'
): Promise<ColumnMetadata[]> {
	const result = await db.query<InformationSchemaColumn>(
		`SELECT column_name, data_type, is_nullable, column_default
		 FROM information_schema.columns
		 WHERE table_name = $1 AND table_schema = $2
		 ORDER BY ordinal_position`,
		[tableName, schema]
	);

	return result.rows.map((row) => ({
		name: row.column_name,
		dataType: mapPostgresType(row.data_type),
		postgresType: row.data_type,
		nullable: row.is_nullable === 'YES',
		hasDefault: row.column_default !== null
	}));
}

/**
 * Get the list of column names for a table.
 * Useful for the query builder's allowedColumns parameter.
 */
export async function getColumnNames(
	db: PGlite,
	tableName: string,
	schema: string = 'public'
): Promise<string[]> {
	const columns = await introspectTable(db, tableName, schema);
	return columns.map((c) => c.name);
}
