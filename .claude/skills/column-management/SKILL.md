---
name: gridlite-column-management
description: "GridLite column visibility, ordering, resizing, and ColumnPicker component. Use when configuring column display, hiding columns, or setting up drag-to-reorder."
user-invocable: true
---

# GridLite Column Management

## Column Visibility

### Enable

```svelte
<GridLite
  features={{ columnVisibility: true }}
  config={{
    id: 'grid',
    defaultVisibleColumns: ['name', 'email', 'department']  // Hide others
  }}
/>
```

The ColumnPicker dropdown appears in the toolbar with:
- Visible / Hidden sections with count badges
- Intra-control search (substring match)
- Show All / Hide All buttons
- Drag handles for reordering

## Column Resizing

### Enable

```svelte
<GridLite
  features={{ columnResizing: true }}
  config={{
    id: 'grid',
    defaultColumnSizing: { name: 250, email: 300 }  // Initial widths
  }}
/>
```

- Drag the right edge of column headers to resize
- Min width: 62px, Max: 1000px, Default: 180px
- `table-layout: fixed` activates automatically
- Width changes reported via `onStateChange`

## Column Reordering

### Enable

```svelte
<GridLite features={{ columnReordering: true }} />
```

- Drag column headers to reorder (HTML5 Drag and Drop)
- Also reorderable via the ColumnPicker drag handles
- Both methods update the same `columnOrder` state

### Default Column Order

```svelte
<GridLite
  config={{
    id: 'grid',
    defaultColumnOrder: ['name', 'department', 'title', 'salary']
  }}
/>
```

## ColumnPicker Features (Session 4-5)

The ColumnPicker supports:
- **Multi-select**: Click, Ctrl/Cmd+Click, Shift+Click
- **Multi-column drag**: Drag selected group to reorder
- **Cross-section drag**: Drag from Hidden to Visible (and vice versa)
- **Keyboard**: Arrow keys navigate, Space toggles visibility, Ctrl+A selects all, Escape clears

## ColumnConfig Reference

```typescript
interface ColumnConfig {
  name: string;           // Must match database column
  label?: string;         // Display label
  dataType?: 'text' | 'number' | 'date' | 'boolean' | 'select';
  format?: (value: unknown) => string;
  visible?: boolean;
  width?: number;         // Default width in px
  minWidth?: number;
  maxWidth?: number;
}
```

## Reading Column State

```svelte
<GridLite
  onStateChange={(state) => {
    console.log(state.columnVisibility);  // { name: true, email: false }
    console.log(state.columnOrder);       // ['name', 'department', ...]
    console.log(state.columnSizing);      // { name: 250, email: 300 }
  }}
/>
```
