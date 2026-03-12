---
name: gridlite-sorting-grouping
description: "GridLite sorting and grouping: SortBar, GroupBar, multi-level grouping with aggregations, programmatic control. Use when configuring sort or group behaviour."
user-invocable: true
---

# GridLite Sorting & Grouping

## Sorting

### Enable

```svelte
<GridLite {db} table="employees" features={{ sorting: true }} />
```

### Default Sort on Load

```svelte
<GridLite
  config={{
    id: 'grid',
    defaultSorting: [
      { column: 'name', direction: 'asc' },
      { column: 'salary', direction: 'desc' }
    ]
  }}
  features={{ sorting: true }}
/>
```

### Programmatic Sort

```typescript
grid.setSorting([{ column: 'hire_date', direction: 'desc' }]);
```

### SortConfig Type

```typescript
interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}
```

### SQL Output

```sql
ORDER BY "name" ASC, "salary" DESC
```

## Grouping

### Enable

```svelte
<GridLite {db} table="employees" features={{ grouping: true }} />
```

### Default Grouping on Load

```svelte
<GridLite
  config={{
    id: 'grid',
    defaultGrouping: [
      {
        column: 'department',
        aggregations: [
          { column: 'salary', function: 'avg', alias: 'avg_salary' },
          { column: 'salary', function: 'sum', alias: 'total_salary' }
        ]
      }
    ]
  }}
  features={{ grouping: true }}
/>
```

### Hierarchical Grouping (Max 3 Levels)

Groups are hierarchical, not flat. Grouping by Department then Title:
- Engineering (8)
  - Senior Engineer (3)
    - [detail rows]
  - Engineer (5)
    - [detail rows]
- Marketing (6)
  - ...

Each level is a separate SQL query. Children load on expand (lazy loading).

### Programmatic Grouping

```typescript
grid.setGrouping([
  { column: 'department' },
  { column: 'title', aggregations: [{ column: 'salary', function: 'avg' }] }
]);
```

### GroupConfig Type

```typescript
interface GroupConfig {
  column: string;
  aggregations?: AggregationConfig[];
}

interface AggregationConfig {
  column: string;
  function: 'count' | 'sum' | 'avg' | 'min' | 'max';
  alias?: string;
}
```

### How Grouped View Works

1. **Group headers** span full table width via `colspan`
2. **Grouped columns** are hidden from headers and child rows
3. **Count badge** shows number of rows per group
4. **Aggregation pills** show computed values (Avg Salary: 72,500)
5. **Expand/collapse** loads children lazily via `db.query()`
6. **Pagination** applies to group count, not row count

### SQL Strategy

```sql
-- Top-level summary
SELECT "department", COUNT(*) AS _count, AVG("salary") AS avg_salary
FROM employees GROUP BY "department" ORDER BY "department"

-- Child rows on expand
SELECT * FROM employees WHERE "department" = $1 ORDER BY "name"
```
