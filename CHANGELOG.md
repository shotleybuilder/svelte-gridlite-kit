# Changelog

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
