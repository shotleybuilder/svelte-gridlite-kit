# svelte-gridlite-kit — Build Plan

High-level session plan for building this PGLite-native data grid library, forked from svelte-table-kit v0.15.1.

## Current State

- Scaffold only: package.json, configs, empty `src/lib/` directories with `.gitkeep` files
- Architecture docs written (CLAUDE.md, README.md, docs/architecture-review.md)
- No source code yet
- svelte-table-kit source available at `~/Desktop/svelte-table-kit` as reference (~6,300 LOC)

## Session Breakdown

Sessions are ordered by dependency — each builds on the previous. Each session should produce a committable, testable increment.

---

### Session 1: Types & Query Builder Foundation

**Goal:** Define the type system and build the parameterized SQL query builder — the core engine that replaces TanStack Table.

**Deliverables:**
- `src/lib/types.ts` — Adapted from svelte-table-kit types: remove TanStack dependencies, add PGLite-specific types (table name, raw query), keep FilterCondition/FilterOperator/SortConfig/ClassNameMap/TableFeatures/ViewPreset
- `src/lib/query/builder.ts` — FilterCondition → parameterized WHERE clauses, ORDER BY from SortConfig, GROUP BY support, LIMIT/OFFSET pagination, COUNT(*) for totals
- `src/lib/query/builder.test.ts` — Verify parameterized output for every operator, SQL injection edge cases, compound AND/OR logic

**Key decisions:**
- FilterOperator type maps directly to SQL operators (e.g. `contains` → `ILIKE '%' || $1 || '%'`)
- All queries return `{ sql: string, params: any[] }` — never raw string concatenation
- Column names validated against schema metadata (whitelist approach)

**Reference:** svelte-table-kit `types.ts` (169 LOC), `utils/filters.ts` (239 LOC)

---

### Session 2: Schema Introspection & PGLite Live Query Wrapper

**Goal:** Build the schema introspection layer and Svelte-compatible reactive bindings for PGLite live queries.

**Deliverables:**
- `src/lib/query/schema.ts` — Query `information_schema.columns` for a table, map Postgres types to UI ColumnDataType (text/number/date/boolean/select), return column metadata array
- `src/lib/query/schema.test.ts` — Test against in-memory PGLite with known table schemas
- `src/lib/query/live.ts` — Svelte store wrapper around `pglite.live.query()`, handles subscribe/unsubscribe lifecycle, exposes loading/error/data states
- `src/lib/query/live.test.ts` — Verify reactivity, cleanup on unsubscribe

**Key decisions:**
- Schema introspection runs once on component mount, cached per table
- Live query store follows Svelte store contract (subscribe method)
- Error states surfaced to UI (not swallowed)

**Reference:** No direct svelte-table-kit equivalent — this is new code. PGLite docs for `live.query()` API.

---

### Session 3: State Persistence (Views & Migrations)

**Goal:** Replace localStorage persistence with PGLite-backed config storage.

**Deliverables:**
- `src/lib/state/migrations.ts` — Create `_gridlite_views` and `_gridlite_column_state` tables, version-tracked migration runner
- `src/lib/state/views.ts` — CRUD for view configs (column visibility, ordering, sizing, filter/sort presets), load/save per grid instance
- `src/lib/state/migrations.test.ts` — Verify table creation, migration idempotency
- `src/lib/state/views.test.ts` — Round-trip save/load, multiple views per table

**Key decisions:**
- Config tables prefixed `_gridlite_` to avoid collision with user tables
- Migration version stored in a `_gridlite_meta` table
- Views identified by grid instance ID (from `config.id`)

**Reference:** svelte-table-kit `stores/persistence.ts` (conceptually — completely different implementation)

---

### Session 4: Utilities (Fuzzy Search & Formatters)

**Goal:** Port utility functions from svelte-table-kit, adapting where needed.

**Deliverables:**
- `src/lib/utils/fuzzy.ts` — Fuzzy search with scoring (direct port, may be used for column picker / command palette)
- `src/lib/utils/fuzzy.test.ts` — Port existing tests
- `src/lib/utils/formatters.ts` — Date, currency, number formatters (direct port)
- `src/lib/styles/gridlite.css` — Base styles adapted from svelte-table-kit's table-kit.css

**Reference:** svelte-table-kit `utils/fuzzy.ts` (176 LOC), `utils/formatters.ts` (50 LOC)

---

### Session 5: GridLite.svelte — Main Component (Minimal)

**Goal:** Build the main component shell that wires together query builder, live queries, schema introspection, and state persistence. No sub-components yet — just renders a basic table.

**Deliverables:**
- `src/lib/GridLite.svelte` — Accepts `db` (PGLite instance) + `table` (string) or `query` (string), feature flags, styling props. On mount: introspect schema, build query, subscribe to live results, render `<table>` with column headers and rows.
- `src/lib/index.ts` — Public API exports (GridLite, types, utilities)
- `src/routes/+page.svelte` — Dev demo page with sample PGLite table and GridLite component

**Key decisions:**
- Props: `db`, `table`, `query`, `config`, `features`, `classNames`, `rowHeight`, `columnSpacing`, `onRowClick`
- Query rebuilds reactively when filter/sort/page state changes
- Column headers from schema introspection (or user-provided column config)

**Reference:** svelte-table-kit `TableKit.svelte` (1,859 LOC) — but much simpler since SQL replaces most logic

---

### Session 6: FilterBar & FilterCondition Components

**Goal:** Port and adapt the filtering UI to emit SQL-compatible filter conditions.

**Deliverables:**
- `src/lib/components/FilterBar.svelte` — Adapted from svelte-table-kit, emits FilterCondition[] that the query builder converts to WHERE clauses
- `src/lib/components/FilterCondition.svelte` — Individual filter row with column picker, operator dropdown (adapted per ColumnDataType), value input
- Wire into GridLite.svelte

**Key decisions:**
- Operator list per column type comes from schema introspection
- Value suggestions via `SELECT DISTINCT` (async, debounced)
- AND/OR logic toggle

**Reference:** svelte-table-kit `FilterBar.svelte` (421 LOC), `FilterCondition.svelte` (808 LOC)

---

### Session 7: SortBar & GroupBar Components

**Goal:** Port sorting and grouping UI controls.

**Deliverables:**
- `src/lib/components/SortBar.svelte` — Multi-column sort, emits SortConfig[] → ORDER BY
- `src/lib/components/SortCondition.svelte` — Individual sort row
- `src/lib/components/GroupBar.svelte` — Multi-level grouping, emits group config → GROUP BY with aggregation
- Wire into GridLite.svelte

**Reference:** svelte-table-kit `SortBar.svelte` (257 LOC), `SortCondition.svelte` (147 LOC), `GroupBar.svelte` (310 LOC)

---

### Session 8: Context Menus, Column Menu & Row Detail

**Goal:** Port the remaining interactive UI components.

**Deliverables:**
- `src/lib/components/CellContextMenu.svelte` — Right-click actions (filter by value, exclude, greater/less than)
- `src/lib/components/ColumnMenu.svelte` — Column visibility, reordering, resizing controls
- `src/lib/components/RowDetailModal.svelte` — Row detail overlay with prev/next navigation
- Wire into GridLite.svelte

**Reference:** svelte-table-kit `CellContextMenu.svelte` (233 LOC), `ColumnMenu.svelte` (291 LOC), `RowDetailModal.svelte` (214 LOC)

---

### Session 9: Pagination & Global Search

**Goal:** Add SQL-based pagination and global search.

**Deliverables:**
- Pagination UI in GridLite.svelte — page controls, page size selector
- `LIMIT/OFFSET` query integration with `COUNT(*)` for total
- Global search input — `ILIKE` across text columns (or FTS if feasible)
- Wire into query builder

---

### Session 10: Integration Testing, Demo App & Package Prep

**Goal:** End-to-end testing, polished demo, npm package readiness.

**Deliverables:**
- Integration tests: full component with PGLite in-memory, verify filter→query→results pipeline
- Demo app in `src/routes/` with realistic dataset
- Package build (`npm run package`), publint validation
- Final `index.ts` exports audit
- README usage examples updated

---

## Dependency Graph

```
S1 (types + query builder)
├── S2 (schema + live queries)
│   └── S5 (GridLite main component)
│       └── S5a (dev demo app)
│       ├── S6 (FilterBar)
│       ├── S7 (SortBar + GroupBar)
│       ├── S8 (context menus + row detail)
│       └── S9 (pagination + global search)
├── S3 (state persistence)
│   └── S5
└── S4 (utilities + styles)
    └── S5

S10 (integration + packaging) depends on all above
```

---

### Session 5a: Dev Demo App

**Goal:** Build a standalone demo app in `src/routes/` so the library can be manually tested via `npm run dev` without installing into a real project. Every subsequent UI session (6–9) benefits from this — new components can be exercised immediately.

**Inserts after:** Session 5 (GridLite main component must exist)
**Blocks:** Nothing — all later sessions can proceed without it, but it accelerates UI development

**Deliverables:**
- `src/routes/+page.svelte` — Main demo page: initializes an in-memory PGLite instance, creates and seeds a sample table (e.g. employees with name, department, salary, hire_date, active), renders GridLite with feature flags enabled
- `src/routes/+layout.svelte` — Minimal layout with nav if multiple demo pages
- Sample data seeding helper (inline or small utility) — ~50–100 rows of realistic test data
- Optional: `src/routes/wide-table/+page.svelte` — Wide table demo (many columns) to test horizontal scroll, column visibility, resizing

**Key decisions:**
- PGLite initialized client-side only (browser WASM constraint) — use `onMount` or SvelteKit `ssr: false`
- Sample data should cover all column types: text, number, date, boolean, select-like (department/status)
- Demo page should expose toggle controls for feature flags so each feature can be tested in isolation
- Keep it simple — this is a dev tool, not a marketing page

**Reference:** svelte-table-kit `src/routes/+page.svelte` (258 LOC), `src/routes/wide-table/+page.svelte` (336 LOC)

---

## Estimated Scope

- ~10 sessions + 1 demo session (5a)
- svelte-table-kit reference: ~6,300 LOC across 20 files
- Expected gridlite output: similar LOC count but with SQL-heavy logic replacing array iteration
- Each session targets 1-3 files + tests, committable independently
