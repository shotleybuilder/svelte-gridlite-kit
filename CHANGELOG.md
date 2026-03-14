# Changelog

## 0.4.5 — 2026-03-14

### Fixed

- **Crash when removing all grouping** — `rebuildGroupedQuery()` now guards against empty `validGrouping`, preventing `validGrouping[0] is undefined` error when clearing the GroupBar (#12)
- **Column resize handles not working** — Added `position: relative` to `.gridlite-th` so resize handles position correctly within their header cell (#11)
- **Column menu button clipped on narrow columns** — Label now truncates with ellipsis (`min-width: 0; overflow: hidden`) and menu button uses `flex-shrink: 0` to stay visible (#10)

## 0.4.4 — 2026-03-14

### Fixed

- **Grouped mode: loading state stuck forever with `defaultGrouping`** — `rebuildGroupedQuery()` now sets `storeState.loading = false` on completion. Previously, grouped mode skipped creating a live store, so the loading gate never opened and the template showed "Loading..." indefinitely.

## 0.4.3 — 2026-03-14

### Fixed

- **Grouped mode: top-level ORDER BY includes deeper-level group columns** — Follow-up to 0.4.2. Top-level summary queries now filter sorting to only the top-level group column. Sub-group queries filter sorting to parent + current level columns only. Previously, all group level columns were included, causing Postgres errors on multi-level grouping.

## 0.4.2 — 2026-03-14

### Fixed

- **Grouped mode: ORDER BY on non-grouped columns crashes** — Summary queries now filter `sorting` to only include columns present in `GROUP BY`. Detail rows (expanded groups) keep the full sort order. Fixes Postgres error: `column must appear in the GROUP BY clause or be used in an aggregate function`.

## 0.4.1 — 2026-03-14

### Fixed

- **`setFilters`/`setSorting`/`setGrouping` throw before first query result** — `quoteIdentifier()` now skips allowlist validation when `allowedColumns` is empty (e.g. before columns are derived from the first query result in query mode). The regex identifier check still prevents SQL injection.

## 0.4.0 — 2026-03-14

### Added

- **Full toolbar in query mode** — Filter, sort, group, search, pagination, column visibility, column menu, and toolbar slots now work with the `query` prop. The consumer's SQL is wrapped as a subquery (`SELECT * FROM (...) AS _gridlite_sub WHERE/ORDER BY/LIMIT`) so all UI controls apply clauses on top.
- **`source` option in query builder** — `buildQuery`, `buildCountQuery`, `buildGroupSummaryQuery`, `buildGroupCountQuery`, and `buildGroupDetailQuery` accept an optional `source` (raw SQL string) as an alternative to `table`. Exported `resolveFrom()` helper.
- **FilterBar `source` prop** — `SELECT DISTINCT` value suggestions and `MIN/MAX` range hints work in query mode via the `source` prop.

### Changed

- Removed `{#if table}` guards on toolbar, aggrid layout, and column header menu — all render in both table and query modes.
- Raw query demo (`/examples/raw-query`) updated with all features enabled (filter, sort, group, pagination, search, column controls).

### Migration from 0.3.x

No breaking changes. Existing `table` prop usage is unchanged. The `query` prop now gets full feature parity with `table` mode automatically.

## 0.3.1 — 2026-03-13

### Fixed

- **`query` prop renders empty grid** — When using raw SQL via the `query` prop, columns were never derived from result fields, causing the grid to show "No data" even with rows present. Columns are now auto-derived from `storeState.fields` using a new OID-to-ColumnDataType mapper.

### Added

- `mapOidToDataType()` — Maps Postgres type OIDs (from live query result fields) to GridLite `ColumnDataType`. Exported from the public API.

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
