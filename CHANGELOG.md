# Changelog

## 0.5.1 — 2026-03-30

### Fixed

- **`applyConfig()` group labels show `(Empty)` due to stale reactive state** — `rebuildGroupedQuery()` and `fetchGroupChildren()` now derive valid grouping directly from the `grouping` variable instead of the `$: validGrouping` reactive declaration, which hasn't re-run yet when called synchronously from `applyConfig()`. Previously, switching between views with different grouping columns would read the previous view's grouping, producing `(Empty)` labels (#26)
- **`gridlite-adapter-tanstack-db` 0.5.0 published without `dist/`** — Rebuilt and republished as 0.5.1 (#25)

## 0.5.1-pglite — 2026-03-30 (`@shotleybuilder/gridlite-adapter-pglite` only)

### Fixed

- **Stale PGLite adapter instance** — Version bump to resolve stale adapter dependency in consuming projects

## 0.5.0 — 2026-03-29

### Breaking Changes

- **Monorepo with pluggable adapter architecture** — The project is now a pnpm workspaces monorepo with three packages: `@shotleybuilder/svelte-gridlite-kit` (core), `@shotleybuilder/gridlite-adapter-pglite` (PGLite adapter), and a private demo app (#23)
- **`adapter` prop replaces `db`/`table`/`query`** — `GridLite` now accepts a single `adapter: QueryAdapter` prop instead of `db: PGliteWithLive`, `table: string`, and `query: string`
- **PGLite-specific code moved to separate package** — `createLiveQueryStore`, `introspectTable`, `getColumnNames`, `runMigrations`, `saveView`, `loadView`, `saveColumnState`, `loadColumnState`, and all other PGLite-specific functions are now exported from `@shotleybuilder/gridlite-adapter-pglite` instead of the core package
- **Core has no `@electric-sql/pglite` runtime dependency** — PGLite is now a peer dependency of the adapter package only
- **Adapter interface uses structured descriptors instead of SQL strings** — `createLiveQuery()`, `executeCount()`, `executeGroupSummary()`, `executeGroupCount()`, and `executeGroupDetail()` now accept typed descriptor objects (`QueryDescriptor`, `CountDescriptor`, etc.) instead of raw SQL. Custom adapter implementations must be updated.

### Added

- **`QueryAdapter` interface** (`packages/core/src/lib/adapter.ts`) — Database-agnostic contract for grid data operations using structured descriptors: `init()`, `introspect()`, `createLiveQuery(QueryDescriptor)`, `executeCount(CountDescriptor)`, `executeGroupSummary()`, `executeGroupCount()`, `executeGroupDetail()`, `loadColumnState()`, `saveColumnState()`, `getDistinctValues()`, `getNumericRange()`
- **Structured query descriptors** — `QueryDescriptor`, `CountDescriptor`, `GroupSummaryDescriptor`, `GroupCountDescriptor`, `GroupDetailDescriptor` replace raw SQL strings in the adapter interface, enabling non-SQL backends
- **`LiveQueryHandle` / `LiveQueryState` interfaces** — Svelte store-compatible reactive query subscription types
- **`PGLiteAdapter` class** (`packages/pglite/src/adapter.ts`) — Full implementation of `QueryAdapter` for PGLite, created via `createPGLiteAdapter({ db, table })` or `createPGLiteAdapter({ db, query })`
- **`TanStackDBAdapter` class** (`packages/tanstack-db/src/adapter.ts`) — Full implementation of `QueryAdapter` for TanStack DB collections, created via `createTanStackDBAdapter({ collection, columns })` or `createTanStackDBAdapter({ collection, schema })` with Zod schema support
- **`@shotleybuilder/gridlite-adapter-tanstack-db` package** — New adapter package with pluggable `StorageProvider` for state persistence (`InMemoryStorage`, `LocalStorageProvider`), operator mapping, query translation, and `createLiveQueryCollection`-based reactive queries
- **68 adapter integration tests** in the pglite package, **74 tests** in the tanstack-db package

### Changed

- **Skills / documentation updated for adapter architecture** — All `.claude/skills/` files updated to use `adapter` prop instead of `db`/`table`. Quick-start skill now covers both PGLite and TanStack DB setup paths.

### Migration from 0.4.x

```diff
- import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
+ import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
+ import { createPGLiteAdapter } from '@shotleybuilder/gridlite-adapter-pglite';

+ const adapter = createPGLiteAdapter({ db, table: 'employees' });

- <GridLite {db} table="employees" ... />
+ <GridLite {adapter} ... />
```

For raw query mode:
```diff
- <GridLite {db} query="SELECT * FROM ..." ... />
+ const adapter = createPGLiteAdapter({ db, query: 'SELECT * FROM ...' });
+ <GridLite {adapter} ... />
```

For TanStack DB (new backend option):
```typescript
import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
import { createTanStackDBAdapter } from '@shotleybuilder/gridlite-adapter-tanstack-db';

const adapter = createTanStackDBAdapter({ collection: myCollection, columns: [...] });

<GridLite {adapter} ... />
```

## 0.4.18 — 2026-03-29

### Fixed

- **Stale `isGrouped` reactive when removing grouping** — `rebuildQuery()` now computes grouped state from the `grouping` variable directly instead of the Svelte `$: isGrouped` reactive, which is stale during the same synchronous tick. Previously, `setGrouping([])` or `applyConfig()` would see `isGrouped = true` (stale), enter the grouped path, hit an early return, and leave the grid showing stale data (#22)

## 0.4.17 — 2026-03-29

### Added

- **`applyConfig()` batch API** — New method to set filters, sorting, grouping, global search, and pagination atomically in a single call, triggering one `rebuildQuery()` instead of multiple independent rebuilds. Prevents async race conditions when switching views programmatically (#21)

## 0.4.16 — 2026-03-28

### Fixed

- **Filter dropdown regression** — The `overflow: hidden` fix from 0.4.15 clipped the column picker and value suggestion dropdowns. Replaced with `width: 0` on flex inputs/selects so they yield space to the remove button without clipping positioned descendants (#20)

## 0.4.15 — 2026-03-28

### Fixed

- **JSONB filter type errors** — Context menu "Filter by value" on JSONB cells now uses `jsonb_has_key`/`jsonb_not_has_key` operators instead of `equals`/`not_equals`, which caused "invalid input syntax for type json". `is_empty`/`is_not_empty` operators now use `::text` cast so they work on JSONB columns. JSONB `?` operator params cast to `::text` for type safety (#20)
- **Filter remove button visibility** — The × button to remove a filter condition was hidden behind the value input. Restyled as a clean × character. Filter panel capped at `max-width: calc(100vw - 2rem)` (#20)

## 0.4.14 — 2026-03-28

### Fixed

- **JSONB filter suggestions show individual keys instead of raw JSON objects** — For columns with `json` data type (e.g. multi-select fields stored as JSONB), filter value suggestions now use `SELECT DISTINCT jsonb_object_keys(col)` to extract individual keys rather than `SELECT DISTINCT col::TEXT` which returned whole serialised JSON objects. Affects both `FilterBar.svelte` and `FilterGroup.svelte` (#20)

## 0.4.13 — 2026-03-28

### Added

- **Column-to-column comparison with interval offset** — Filter conditions can now compare one column against another instead of a literal value. New optional `valueColumn` and `intervalOffset` fields on `FilterCondition` enable expressions like `WHERE "updated_at" > "created_at" + INTERVAL '6 months'`. The FilterCondition UI adds a toggle button to switch between literal value and column comparison modes; column mode shows a fuzzy-search column picker for the RHS and an optional interval offset input for date-compatible operators. Interval strings are validated against a strict regex pattern to prevent SQL injection. The `valueColumn` is validated through `quoteIdentifier()` with the same allowedColumns check as the LHS field. Fully backwards-compatible — existing conditions without `valueColumn` behave unchanged (#19)

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
