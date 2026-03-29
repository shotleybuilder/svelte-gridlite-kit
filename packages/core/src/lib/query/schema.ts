/**
 * Postgres Type Mapping for GridLite
 *
 * Pure functions that map Postgres data types and OIDs to GridLite's
 * ColumnDataType. No database dependency.
 */

import type { ColumnDataType } from "../types.js";

// ─── Postgres Type → ColumnDataType Mapping ─────────────────────────────────

/**
 * Map a Postgres data_type string (from information_schema.columns)
 * to a GridLite ColumnDataType.
 */
export function mapPostgresType(postgresType: string): ColumnDataType {
  const t = postgresType.toLowerCase();

  // Numeric types
  if (
    t === "integer" ||
    t === "bigint" ||
    t === "smallint" ||
    t === "numeric" ||
    t === "decimal" ||
    t === "real" ||
    t === "double precision" ||
    t === "serial" ||
    t === "bigserial" ||
    t === "smallserial" ||
    t === "money"
  ) {
    return "number";
  }

  // Date/time types
  if (
    t === "date" ||
    t === "timestamp without time zone" ||
    t === "timestamp with time zone" ||
    t === "time without time zone" ||
    t === "time with time zone" ||
    t === "interval"
  ) {
    return "date";
  }

  // Boolean
  if (t === "boolean") {
    return "boolean";
  }

  // JSON types
  if (t === "json" || t === "jsonb") {
    return "json";
  }

  // Everything else is text (varchar, char, text, uuid, etc.)
  return "text";
}

// ─── OID → ColumnDataType Mapping ───────────────────────────────────────────

/**
 * Map a Postgres type OID (from query result fields) to a GridLite ColumnDataType.
 * Used when introspecting columns from raw query results rather than information_schema.
 *
 * Common OIDs from the Postgres catalog (pg_type):
 * https://github.com/postgres/postgres/blob/master/src/include/catalog/pg_type.dat
 */
const OID_MAP: Record<number, ColumnDataType> = {
  // Boolean
  16: "boolean",
  // Numeric
  20: "number", // int8 / bigint
  21: "number", // int2 / smallint
  23: "number", // int4 / integer
  26: "number", // oid
  700: "number", // float4 / real
  701: "number", // float8 / double precision
  790: "number", // money
  1700: "number", // numeric / decimal
  // Date/time
  1082: "date", // date
  1083: "date", // time
  1114: "date", // timestamp without time zone
  1184: "date", // timestamp with time zone
  1186: "date", // interval
  1266: "date", // time with time zone
  // JSON
  114: "json", // json
  3802: "json", // jsonb
};

/**
 * Map a Postgres type OID to a GridLite ColumnDataType.
 * Returns 'text' for unrecognized OIDs.
 */
export function mapOidToDataType(oid: number): ColumnDataType {
  return OID_MAP[oid] ?? "text";
}
