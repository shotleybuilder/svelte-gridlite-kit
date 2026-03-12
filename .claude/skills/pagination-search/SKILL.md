---
name: gridlite-pagination-search
description: "GridLite pagination and global search: page size options, programmatic page control, global search setup. Use when configuring pagination or search."
user-invocable: true
---

# GridLite Pagination & Search

## Pagination

### Enable (On by Default)

```svelte
<GridLite
  features={{ pagination: true }}
  config={{
    id: 'grid',
    pagination: {
      pageSize: 25,
      pageSizeOptions: [10, 25, 50, 100]
    }
  }}
/>
```

### Disable Pagination

```svelte
<GridLite features={{ pagination: false }} />
```

### Programmatic Page Control

```typescript
grid.setPage(0);         // Go to first page
grid.setPage(5);         // Go to page 6 (0-indexed)
grid.setPageSize(50);    // Change page size (resets to page 0)
```

### SQL Implementation

```sql
-- Page 2, 25 per page
SELECT * FROM employees ORDER BY "id" LIMIT 25 OFFSET 25

-- Total count for pagination controls
SELECT COUNT(*) AS total FROM employees
```

### Pagination with Grouping

When grouping is active, pagination applies to **group count**, not row count:
- "Page 1 of 3 (50 groups)" instead of "Page 1 of 10 (250 rows)"

## Global Search

### Enable

```svelte
<GridLite features={{ globalSearch: true }} />
```

### Behaviour

- Search input appears in the toolbar
- 300ms debounce on input
- Searches across **all text columns** using `ILIKE`
- Resets to page 0 on search
- Clear button appears when search is active

### Programmatic Search

```typescript
grid.setGlobalFilter('engineering');
grid.setGlobalFilter('');  // Clear search
```

### SQL Implementation

```sql
-- Searches all text columns with OR
WHERE ("name" ILIKE '%' || $1 || '%'
   OR "email" ILIKE '%' || $1 || '%'
   OR "department" ILIKE '%' || $1 || '%')
```

### Combined with Filters

Global search combines with FilterBar conditions using AND:

```sql
WHERE ("department" = $1)                    -- from FilterBar
  AND ("name" ILIKE '%' || $2 || '%'         -- from global search
       OR "email" ILIKE '%' || $2 || '%')
```
