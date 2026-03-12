---
name: gridlite-filtering
description: "GridLite filtering: enabling FilterBar, filter operators by column type, programmatic filter control, AND/OR logic. Use when adding or configuring filters."
user-invocable: true
---

# GridLite Filtering

## Enable Filtering

```svelte
<GridLite
  {db}
  table="employees"
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

## Default Filters on Load

```svelte
<GridLite
  {db}
  table="employees"
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
  field: string;           // Column name
  operator: FilterOperator; // One of the operators above
  value: unknown;          // Filter value
}
```

## How It Works (SQL)

Filters translate to parameterized `WHERE` clauses:

```sql
-- { field: 'name', operator: 'contains', value: 'alice' }
WHERE "name" ILIKE '%' || $1 || '%'

-- { field: 'salary', operator: 'greater_than', value: 70000 }
WHERE "salary" > $1

-- AND/OR logic combines multiple conditions
WHERE "department" = $1 AND "salary" > $2
```

All values are parameterized — never string-interpolated.

## Context Menu Filtering

When filtering is enabled, right-clicking a cell offers:
- **Filter by this value** (equals)
- **Exclude this value** (not_equals)
- **Greater than** / **Less than** (numeric columns only)
