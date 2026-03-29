---
name: gridlite-filtering
description: "GridLite filtering: enabling FilterBar, filter operators by column type, programmatic filter control, AND/OR logic. Use when adding or configuring filters."
user-invocable: true
---

# GridLite Filtering

## Enable Filtering

```svelte
<GridLite
  {adapter}
  features={{ filtering: true }}
/>
```

## Filter Operators

Operators are auto-selected based on column type (detected from schema):

| Type | Operators |
|---|---|
| **text** | equals, not_equals, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty |
| **number** | equals, not_equals, greater_than, less_than, greater_or_equal, less_or_equal, is_empty, is_not_empty |
| **date** | equals, not_equals, is_before, is_after, is_empty, is_not_empty |
| **boolean** | equals, is_empty, is_not_empty |
| **json** | jsonb_has_key, jsonb_not_has_key, is_empty, is_not_empty |

## Default Filters on Load

```svelte
<GridLite
  {adapter}
  config={{
    id: 'emp-grid',
    defaultFilters: [
      { id: 'f1', field: 'department', operator: 'equals', value: 'Engineering' },
      { id: 'f2', field: 'salary', operator: 'greater_than', value: 70000 }
    ],
    filterLogic: 'and'   // 'and' (default) or 'or'
  }}
  features={{ filtering: true }}
/>
```

## Programmatic Filter Control

```svelte
<script>
  let grid: GridLite;

  function filterByDepartment(dept: string) {
    grid.setFilters([
      { id: 'dept', field: 'department', operator: 'equals', value: dept }
    ], 'and');
  }

  function clearFilters() {
    grid.setFilters([]);
  }
</script>

<GridLite bind:this={grid} ... />
<button on:click={() => filterByDepartment('Sales')}>Sales Only</button>
```

## FilterCondition Type

```typescript
interface FilterCondition {
  id: string;              // Unique identifier for this filter
  field: string;           // Column name (LHS)
  operator: FilterOperator; // One of the operators above
  value: unknown;          // Filter value (literal — used when valueColumn is absent)
  valueColumn?: string;    // Compare against another column instead of a literal value
  intervalOffset?: string; // Interval offset added to valueColumn, e.g. "6 months"
}
```

## Nested Filter Groups

Filter conditions can be grouped with independent AND/OR logic for complex expressions like `A AND (B OR C)`:

```typescript
import type { FilterNode, FilterGroup, FilterCondition } from '@shotleybuilder/svelte-gridlite-kit';

const filters: FilterNode[] = [
  { id: 'f1', field: 'status', operator: 'equals', value: 'active' },
  {
    id: 'g1',
    logic: 'or',
    children: [
      { id: 'f2', field: 'department', operator: 'equals', value: 'Engineering' },
      { id: 'f3', field: 'department', operator: 'equals', value: 'Sales' }
    ]
  }
];
// Generates: WHERE "status" = $1 AND ("department" = $2 OR "department" = $3)
```

The FilterBar UI has an "Add group" button alongside "Add condition". Groups can be nested up to 3 levels deep.

## Column-to-Column Comparison

Filter conditions can compare one column against another instead of a literal value. Set `valueColumn` on a condition to enable this:

```typescript
const filters: FilterCondition[] = [
  {
    id: 'f1',
    field: 'updated_at',
    operator: 'is_after',
    value: '',
    valueColumn: 'created_at',
    intervalOffset: '6 months'
  }
];
// Generates: WHERE "updated_at" > "created_at" + INTERVAL '6 months'
```

- Supported operators: `equals`, `not_equals`, `greater_than`, `less_than`, `greater_or_equal`, `less_or_equal`, `is_before`, `is_after`
- `intervalOffset` is optional and validated against a strict regex pattern (`\d+ (second|minute|hour|day|week|month|year)s?`)
- The FilterCondition UI shows a toggle button to switch between literal value and column comparison modes

## How It Works (SQL)

Filters translate to parameterized `WHERE` clauses:

```sql
-- { field: 'name', operator: 'contains', value: 'alice' }
WHERE "name" ILIKE '%' || $1 || '%'

-- { field: 'salary', operator: 'greater_than', value: 70000 }
WHERE "salary" > $1

-- AND/OR logic combines multiple conditions
WHERE "department" = $1 AND "salary" > $2

-- JSONB key containment
-- { field: 'metadata', operator: 'jsonb_has_key', value: 'email' }
WHERE "metadata" ? $1

-- Column-to-column comparison with interval offset
-- { field: 'updated_at', operator: 'is_after', valueColumn: 'created_at', intervalOffset: '6 months' }
WHERE "updated_at" > "created_at" + INTERVAL '6 months'

-- Nested group: A AND (B OR C)
WHERE "status" = $1 AND ("department" = $2 OR "department" = $3)
```

All literal values are parameterized — never string-interpolated. Column names are validated against an allowlist. Interval strings are validated against a strict regex pattern.

## Context Menu Filtering

When filtering is enabled, right-clicking a cell offers:
- **Filter by this value** (equals)
- **Exclude this value** (not_equals)
- **Greater than** / **Less than** (numeric columns only)
