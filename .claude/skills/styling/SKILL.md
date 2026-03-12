---
name: gridlite-styling
description: "GridLite styling: row height, column spacing, toolbar layouts, custom CSS classes, theming. Use when customising GridLite appearance."
user-invocable: true
---

# GridLite Styling

## Import Base Styles

```svelte
<script>
  import '@shotleybuilder/svelte-gridlite-kit/styles';
</script>
```

Or import directly:

```typescript
import '@shotleybuilder/svelte-gridlite-kit/styles/gridlite.css';
```

## Row Height

```svelte
<GridLite rowHeight="medium" />
```

| Value | Vertical Padding |
|---|---|
| `'short'` | 4px |
| `'medium'` | 8px (default) |
| `'tall'` | 12px |
| `'extra_tall'` | 16px |

## Column Spacing

```svelte
<GridLite columnSpacing="normal" />
```

| Value | Horizontal Padding |
|---|---|
| `'narrow'` | 6px |
| `'normal'` | 12px (default) |
| `'wide'` | 20px |

## Toolbar Layout

```svelte
<GridLite toolbarLayout="airtable" />
```

| Layout | Description |
|---|---|
| `'airtable'` | Right-aligned: Columns, Filter, Group, Sort, View, Search (default) |
| `'excel'` | Two rows: data controls top, view controls bottom |
| `'shadcn'` | Search left, data controls middle, view controls right |
| `'aggrid'` | Sidebar panel (experimental — issue #1) |

## Custom CSS Classes

Override any element's class:

```svelte
<GridLite
  classNames={{
    container: 'my-grid',
    table: 'my-table',
    thead: 'my-header',
    tbody: 'my-body',
    tr: 'my-row',
    th: 'my-header-cell',
    td: 'my-cell',
    pagination: 'my-pagination'
  }}
/>
```

## CSS Class Reference

Key classes for custom styling:

```css
/* Container */
.gridlite-container { }

/* Table */
.gridlite-table { }
.gridlite-thead { }
.gridlite-th { }
.gridlite-td { }
.gridlite-tr { }

/* Toolbar */
.gridlite-toolbar { }
.gridlite-search { }
.gridlite-view-controls { }
.gridlite-view-control-btn { }

/* Grouped view */
.gridlite-group-row { }
.gridlite-group-header { }
.gridlite-group-chevron { }
.gridlite-group-count { }
.gridlite-group-agg { }

/* Pagination */
.gridlite-pagination { }

/* Column picker */
.gridlite-column-picker { }

/* States */
.gridlite-empty { }
.gridlite-loading { }
```

## Theming Example

Override CSS variables or classes:

```css
/* Dark theme override */
.my-grid .gridlite-table { background: #1a1a2e; color: #e0e0e0; }
.my-grid .gridlite-th { background: #16213e; border-color: #2a2a4a; }
.my-grid .gridlite-td { border-color: #2a2a4a; }
.my-grid .gridlite-tr:hover { background: #1a1a3e; }
```
