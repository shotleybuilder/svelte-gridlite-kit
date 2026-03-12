---
name: gridlite-state-callbacks
description: "GridLite state management: onStateChange callback, GridState shape, reading current state, view persistence. Use when tracking or persisting grid state."
user-invocable: true
---

# GridLite State & Callbacks

## onStateChange Callback

Fires when any grid state changes (filters, sort, grouping, pagination, columns):

```svelte
<GridLite
  onStateChange={(state) => {
    console.log('Grid state changed:', state);
  }}
/>
```

## GridState Shape

```typescript
interface GridState {
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  filters: FilterCondition[];
  filterLogic: 'and' | 'or';
  sorting: SortConfig[];
  grouping: GroupConfig[];
  globalFilter: string;
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}
```

## Saving / Restoring State

```svelte
<script>
  import type { GridState } from '@shotleybuilder/svelte-gridlite-kit';

  let savedState: GridState | null = null;

  function handleStateChange(state: GridState) {
    savedState = state;
    // Persist to localStorage, API, or PGLite table
    localStorage.setItem('grid-state', JSON.stringify(state));
  }
</script>

<GridLite onStateChange={handleStateChange} />
```

## Public Methods for Setting State

```typescript
let grid: GridLite;

// Filters
grid.setFilters([
  { id: 'f1', field: 'department', operator: 'equals', value: 'Engineering' }
], 'and');

// Sorting
grid.setSorting([{ column: 'salary', direction: 'desc' }]);

// Grouping
grid.setGrouping([{ column: 'department' }]);

// Pagination
grid.setPage(0);
grid.setPageSize(50);

// Search
grid.setGlobalFilter('alice');
```

## View Persistence (PGLite Tables)

GridLite creates internal tables for state persistence:

```typescript
import { saveView, loadView, loadViews, deleteView } from '@shotleybuilder/svelte-gridlite-kit';

// Save current state as a named view
await saveView(db, {
  id: 'my-view',
  name: 'Engineering Team',
  filters: [...],
  sorting: [...],
  columnVisibility: { ... }
});

// Load all saved views
const views = await loadViews(db, 'my-grid-id');

// Load a specific view
const view = await loadView(db, 'my-view');

// Delete a view
await deleteView(db, 'my-view');
```

## Column State Persistence

```typescript
import { saveColumnState, loadColumnState } from '@shotleybuilder/svelte-gridlite-kit';

// Save column widths, order, visibility
await saveColumnState(db, 'my-grid-id', {
  columnOrder: ['name', 'email', 'department'],
  columnSizing: { name: 250, email: 300 },
  columnVisibility: { id: false }
});

// Load on init
const colState = await loadColumnState(db, 'my-grid-id');
```

## Migration System

GridLite auto-runs migrations on init (`runMigrations(db)`). Config tables:
- `_gridlite_views` — saved view presets
- `_gridlite_column_state` — column display state
