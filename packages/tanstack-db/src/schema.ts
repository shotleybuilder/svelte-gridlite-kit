/**
 * schema.ts — Derive ColumnMetadata from Zod schemas or explicit column lists.
 *
 * Since TanStack DB collections don't have information_schema like Postgres,
 * consumers must provide either explicit ColumnMetadata[] or a Zod schema
 * from which we can derive column metadata at runtime.
 */

import type {
  ColumnMetadata,
  ColumnDataType,
} from "@shotleybuilder/svelte-gridlite-kit/types";

// Zod type identifiers (from ZodFirstPartyTypeKind)
// We check ._def.typeName to determine the Zod type at runtime
type ZodShape = Record<
  string,
  { _def: { typeName: string; innerType?: { _def: { typeName: string } } } }
>;

interface ZodObjectLike {
  shape: ZodShape;
}

/**
 * Derive ColumnMetadata[] from a Zod object schema.
 *
 * Maps Zod types to GridLite data types:
 *   ZodString   → 'text'
 *   ZodNumber   → 'number'
 *   ZodBoolean  → 'boolean'
 *   ZodDate     → 'date'
 *   ZodObject   → 'json'
 *   ZodArray    → 'json'
 *   ZodEnum     → 'text'
 *   (other)     → 'text'
 */
export function deriveColumnsFromZodSchema(
  schema: ZodObjectLike,
): ColumnMetadata[] {
  const shape = schema.shape;
  const columns: ColumnMetadata[] = [];

  for (const [name, field] of Object.entries(shape)) {
    const { dataType, nullable } = resolveZodType(field._def);
    columns.push({
      name,
      dataType,
      postgresType: "unknown",
      nullable,
      hasDefault: false,
    });
  }

  return columns;
}

function resolveZodType(def: {
  typeName: string;
  innerType?: {
    _def: { typeName: string; innerType?: { _def: { typeName: string } } };
  };
}): {
  dataType: ColumnDataType;
  nullable: boolean;
} {
  const typeName = def.typeName;

  // Unwrap optional/nullable wrappers
  if (typeName === "ZodOptional" || typeName === "ZodNullable") {
    if (def.innerType) {
      const inner = resolveZodType(def.innerType._def);
      return { ...inner, nullable: true };
    }
    return { dataType: "text", nullable: true };
  }

  // Unwrap default
  if (typeName === "ZodDefault") {
    if (def.innerType) {
      return resolveZodType(def.innerType._def);
    }
    return { dataType: "text", nullable: false };
  }

  switch (typeName) {
    case "ZodString":
      return { dataType: "text", nullable: false };
    case "ZodNumber":
    case "ZodBigInt":
      return { dataType: "number", nullable: false };
    case "ZodBoolean":
      return { dataType: "boolean", nullable: false };
    case "ZodDate":
      return { dataType: "date", nullable: false };
    case "ZodObject":
    case "ZodArray":
    case "ZodRecord":
      return { dataType: "json", nullable: false };
    case "ZodEnum":
    case "ZodNativeEnum":
      return { dataType: "text", nullable: false };
    default:
      return { dataType: "text", nullable: false };
  }
}
