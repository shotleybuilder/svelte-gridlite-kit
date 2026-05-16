/**
 * operator-map.ts — Maps GridLite FilterOperator → TanStack DB expressions.
 *
 * Each mapping function takes a field reference (from the query builder's
 * context proxy) and a condition value, returning a TanStack DB expression.
 */

import {
  eq,
  gt,
  gte,
  lt,
  lte,
  ilike,
  isNull,
  and,
  or,
  not,
} from "@tanstack/db";
import type { FilterCondition } from "@shotleybuilder/svelte-gridlite-kit/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FieldRef = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Expression = any;

/**
 * Translate a single FilterCondition into a TanStack DB expression.
 *
 * @param fieldRef  - The field reference from the query builder context (e.g. source.name)
 * @param condition - The GridLite filter condition
 * @param getFieldRef - Optional function to resolve a column name to a field ref (for valueColumn)
 * @returns A TanStack DB expression, or null if the condition cannot be translated
 */
export function translateCondition(
  fieldRef: FieldRef,
  condition: FilterCondition,
  getFieldRef?: (column: string) => FieldRef,
): Expression | null {
  const { operator, value } = condition;

  // Column-to-column comparison
  if (condition.valueColumn && getFieldRef) {
    if (condition.intervalOffset) {
      throw new Error(
        `TanStack DB adapter does not support interval offsets. ` +
          `Pre-compute date offsets in your collection data instead.`,
      );
    }
    const rhsRef = getFieldRef(condition.valueColumn);
    return translateComparison(operator, fieldRef, rhsRef);
  }

  switch (operator) {
    case "equals":
      return eq(fieldRef, value);
    case "not_equals":
      return not(eq(fieldRef, value));
    case "contains":
      return ilike(fieldRef, `%${value}%`);
    case "not_contains":
      return not(ilike(fieldRef, `%${value}%`));
    case "starts_with":
      return ilike(fieldRef, `${value}%`);
    case "ends_with":
      return ilike(fieldRef, `%${value}`);
    case "greater_than":
    case "is_after":
      return gt(fieldRef, value);
    case "less_than":
    case "is_before":
      return lt(fieldRef, value);
    case "greater_or_equal":
      return gte(fieldRef, value);
    case "less_or_equal":
      return lte(fieldRef, value);
    case "is_empty":
      return or(isNull(fieldRef), eq(fieldRef, ""));
    case "is_not_empty":
      return and(not(isNull(fieldRef)), not(eq(fieldRef, "")));
    case "in":
      // Handled via fn.where() fallback for O(1) Set-based membership check
      return null;
    case "jsonb_has_key":
    case "jsonb_not_has_key":
      // These require fn.where() functional fallback — handled at the translator level
      return null;
    default:
      return null;
  }
}

/**
 * Translate a comparison operator for column-to-column comparisons.
 */
function translateComparison(
  operator: string,
  lhs: FieldRef,
  rhs: FieldRef,
): Expression | null {
  switch (operator) {
    case "equals":
      return eq(lhs, rhs);
    case "not_equals":
      return not(eq(lhs, rhs));
    case "greater_than":
    case "is_after":
      return gt(lhs, rhs);
    case "less_than":
    case "is_before":
      return lt(lhs, rhs);
    case "greater_or_equal":
      return gte(lhs, rhs);
    case "less_or_equal":
      return lte(lhs, rhs);
    default:
      return null;
  }
}
