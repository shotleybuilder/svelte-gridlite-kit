# Changelog

## 0.3.0 — 2026-03-13

### Added

- **User-editable column labels** — Double-click any column header to rename it inline. Commit with Enter or blur, cancel with Escape. Reverts to the default label when cleared.
- **Label persistence** — Custom labels are saved to `_gridlite_column_state` via a new `label TEXT` column (migration v2) and restored on init.
- **Label propagation** — Custom labels flow through to FilterBar, SortBar, GroupBar, ColumnPicker, CellContextMenu, and RowDetailModal via a merged `columnConfigs` object.

### Migration from 0.2.x

No breaking changes. The v2 migration (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS label TEXT`) runs automatically on init. Existing column state is preserved with `label` defaulting to `NULL`.

## 0.2.1 — 2026-03-13

- Widened `@electric-sql/pglite` peer dependency from `^0.2.0` to `>=0.2.0` for 0.3.x compatibility.

## 0.2.0 — 2026-03-13

### Added

- **`<slot name="cell">`** — Rich HTML cell rendering with `let:value`, `let:row`, `let:column`. Supports badges, links, buttons, colored tags, and any HTML/component content. Falls back to `format()` string functions when no slot is provided.
- **`<slot name="toolbar-start">` / `<slot name="toolbar-end">`** — Inject custom buttons and controls into the grid toolbar (both standard and aggrid layouts).
- **`<slot name="row-detail">`** — Override the default row detail modal content with `let:row`, `let:close`. Uses `$$slots` detection to fall back to the built-in definition list when not provided.
- Updated `/examples/custom-cells` demo with rich cell rendering: stock badges, star ratings, category tags, status badges, edit buttons, and a toolbar export button.

### Migration from 0.1.0

No breaking changes. Existing `format()` functions continue to work. The new slots are purely additive — use them only when you need HTML beyond plain text.

## 0.1.0

Initial release. SQL-native data grid with filtering, sorting, grouping, pagination, column management, and toolbar layout presets.
