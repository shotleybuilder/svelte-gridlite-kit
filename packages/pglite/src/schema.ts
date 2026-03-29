/**
 * Schema Introspection for PGLite
 *
 * Queries information_schema.columns to discover column names, types,
 * and nullability for a given table.
 */

import type { PGlite } from "@electric-sql/pglite";
import type { ColumnMetadata } from "@shotleybuilder/svelte-gridlite-kit/types";
import { mapPostgresType } from "@shotleybuilder/svelte-gridlite-kit/schema";

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
 */
export async function introspectTable(
  db: PGlite,
  tableName: string,
  schema: string = "public",
): Promise<ColumnMetadata[]> {
  const result = await db.query<InformationSchemaColumn>(
    `SELECT column_name, data_type, is_nullable, column_default
		 FROM information_schema.columns
		 WHERE table_name = $1 AND table_schema = $2
		 ORDER BY ordinal_position`,
    [tableName, schema],
  );

  return result.rows.map((row) => ({
    name: row.column_name,
    dataType: mapPostgresType(row.data_type),
    postgresType: row.data_type,
    nullable: row.is_nullable === "YES",
    hasDefault: row.column_default !== null,
  }));
}

/**
 * Get the list of column names for a table.
 * Useful for the query builder's allowedColumns parameter.
 */
export async function getColumnNames(
  db: PGlite,
  tableName: string,
  schema: string = "public",
): Promise<string[]> {
  const columns = await introspectTable(db, tableName, schema);
  return columns.map((c) => c.name);
}
