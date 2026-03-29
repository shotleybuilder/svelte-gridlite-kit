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

## View Persistence

GridLite creates internal tables for state persistence. Use adapter methods for backend-agnostic access:

```typescript
// Save current state as a named view
await adapter.saveView('my-grid-id', {
  id: 'my-view',
  name: 'Engineering Team',
  filters: [...],
  sorting: [...],
  columnVisibility: { ... }
});

// Load all saved views
const views = await adapter.loadViews('my-grid-id');

// Load a specific view
const view = await adapter.loadView('my-view');

// Delete a view
await adapter.deleteView('my-view');

// Default view
await adapter.setDefaultView('my-grid-id', 'my-view');
const def = await adapter.loadDefaultView('my-grid-id');
```

> **Advanced:** The PGLite adapter also exports standalone functions (`saveView(db, gridId, view)`, etc.) from `@shotleybuilder/gridlite-adapter-pglite` for direct PGLite access.

## Column State Persistence

```typescript
// Save column widths, order, visibility, labels
await adapter.saveColumnState('my-grid-id', [
  { name: 'name', visible: true, width: 250, position: 0, label: 'Full Name' },
  { name: 'email', visible: true, width: 300, position: 1, label: null },
  { name: 'id', visible: false, width: null, position: 2, label: null },
]);

// Load on init
const colState = await adapter.loadColumnState('my-grid-id');

// View-scoped column state
await adapter.saveColumnState('my-grid-id', columns, 'my-view');
const scoped = await adapter.loadColumnState('my-grid-id', 'my-view');
```

## Migration System

GridLite auto-runs migrations on `adapter.init()`. Config tables:
- `_gridlite_views` — saved view presets
- `_gridlite_column_state` — column display state
