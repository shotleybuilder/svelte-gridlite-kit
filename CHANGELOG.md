# Changelog

## 0.4.12 — 2026-03-28

### Added

- **JSONB key containment filter operators** — New `jsonb_has_key` and `jsonb_not_has_key` filter operators generate PostgreSQL `?` operator SQL (`"col" ? $1` / `NOT ("col" ? $1)`). Added `"json"` to `ColumnDataType` with automatic detection for `json`/`jsonb` columns via schema introspection and OID mapping. The FilterBar shows "has key" and "does not have key" operators for JSON columns (#18)

## 0.4.11 — 2026-03-28

### Added

- **Nested filter groups** — Filter conditions can now be grouped with independent AND/OR logic, enabling complex expressions like `A AND (B OR C)`. New `FilterGroup` and `FilterNode` types form a discriminated union with the existing `FilterCondition`. The query builder recursively generates parenthesised WHERE clauses with correct `$N` parameter numbering. A new `FilterGroup.svelte` recursive component renders nested groups with visual indentation (up to 3 levels). The FilterBar now has an "Add group" button alongside "Add condition". Fully backwards-compatible — existing flat `FilterCondition[]` usage works unchanged (#17)

## 0.4.10 — 2026-03-27

### Added

- **Hidden column count badge on Columns button** — Shows the number of hidden columns as an indigo badge on the Columns toolbar button, matching the Sort (orange) and Group (green) badge pattern. Badge only appears when columns are hidden (#16)

## 0.4.9 — 2026-03-27

### Fixed

- **notifyStateChange reports stale columnVisibility** — `notifyStateChange()` now builds `columnVisibility` from the synchronous `columnVisibility` state via `isColumnVisible()` instead of the batched `$: visibleColumns` reactive. Also emits all columns (visible and hidden) rather than only visible ones, so consumers saving view state get accurate visibility data (#15)

## 0.4.8 — 2026-03-27

### Fixed

- **TypeError when removing all groups** — `rebuildGroupedQuery()` and `fetchGroupChildren()` now snapshot `validGrouping` at call time and re-check after each `await`, preventing stale reactive state from causing `validGrouping[0] is undefined` when grouping is cleared while an async query is in flight (#14)

## 0.4.7 — 2026-03-27

### Fixed

- **Column resize handles not updating width** — Svelte's reactivity didn't track `columnSizing` changes through the `getColumnWidth()` helper function. Inlined the `columnSizing` lookup directly in the `<th>` style binding so reassignments trigger re-renders. Also added a `gridlite-th-wrapper` div (matching the proven svelte-table-kit pattern) to provide a reliable `position: relative` containing block for the resize handle (#13)

## 0.4.6 — 2026-03-27 [YANKED]

_Published with incomplete fix. Use 0.4.7._

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
