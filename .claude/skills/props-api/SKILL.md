---
name: gridlite-props-api
description: "Complete prop reference for GridLite component: every prop with type, default, and usage. Use when you need to know what props GridLite accepts."
user-invocable: true
---

# GridLite Props API Reference

## Component Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `db` | `PGliteWithLive` | required | PGLite instance with live extension |
| `table` | `string` | — | Table name to query (mutually exclusive with `query`) |
| `query` | `string` | — | Raw SQL query (mutually exclusive with `table`) |
| `config` | `GridConfig` | — | Grid configuration object |
| `features` | `GridFeatures` | `{}` | Feature toggle flags |
| `classNames` | `Partial<ClassNameMap>` | `{}` | Custom CSS class overrides |
| `rowHeight` | `RowHeight` | `'medium'` | Row height variant |
| `columnSpacing` | `ColumnSpacing` | `'normal'` | Column spacing variant |
| `toolbarLayout` | `ToolbarLayout` | `'airtable'` | Toolbar arrangement preset |
| `onRowClick` | `(row) => void` | — | Row click callback |
| `onStateChange` | `(state) => void` | — | State change callback |

## GridConfig

```typescript
interface GridConfig {
  id: string;                              // Unique grid identifier
  columns?: ColumnConfig[];                // Column display config
  defaultVisibleColumns?: string[];        // Columns visible by default
  defaultColumnOrder?: string[];           // Initial column order
  defaultColumnSizing?: Record<string, number>; // Initial column widths
  defaultFilters?: FilterCondition[];      // Filters applied on load
  filterLogic?: 'and' | 'or';             // Filter combination logic
  defaultSorting?: SortConfig[];           // Sort applied on load
  defaultGrouping?: GroupConfig[];         // Grouping applied on load
  pagination?: {
    pageSize: number;                      // Rows per page (default: 25)
    pageSizeOptions?: number[];            // Page size dropdown options
  };
}
```

## GridFeatures

```typescript
interface GridFeatures {
  columnVisibility?: boolean;    // Show/hide columns via picker
  columnResizing?: boolean;      // Drag to resize column widths
  columnReordering?: boolean;    // Drag to reorder column headers
  filtering?: boolean;           // FilterBar with 14+ operators
  sorting?: boolean;             // SortBar with multi-column sort
  pagination?: boolean;          // Page controls (default: true)
  grouping?: boolean;            // GroupBar with hierarchical groups
  globalSearch?: boolean;        // Search across all columns
  rowDetail?: boolean;           // Click row to open detail modal
  rowDetailMode?: 'modal' | 'drawer' | 'inline';
}
```

## ColumnConfig

```typescript
interface ColumnConfig {
  name: string;                  // Must match database column name
  label?: string;                // Display label (defaults to name)
  dataType?: ColumnDataType;     // Override auto-detected type
  format?: (value: unknown) => string;  // Custom cell formatter
  visible?: boolean;             // Default visibility
  width?: number;                // Default width in pixels
  minWidth?: number;             // Min resize width
  maxWidth?: number;             // Max resize width
}
```

## RowHeight

`'short'` | `'medium'` | `'tall'` | `'extra_tall'`

## ColumnSpacing

`'narrow'` | `'normal'` | `'wide'`

## ToolbarLayout

| Value | Description |
|---|---|
| `'airtable'` | Right-aligned: Columns, Filter, Group, Sort, View, Search |
| `'excel'` | Two rows: data controls top, view controls bottom |
| `'shadcn'` | Search left, data controls middle, view controls right |
| `'aggrid'` | Sidebar panel (experimental, see issue #1) |

## Public Methods

Access via `bind:this`:

```svelte
<GridLite bind:this={grid} ... />

<script>
  let grid: GridLite;
  grid.setFilters(filters, logic);
  grid.setSorting(sorting);
  grid.setGrouping(grouping);
  grid.setPage(pageNumber);
  grid.setPageSize(size);
  grid.setGlobalFilter(searchTerm);
</script>
```
