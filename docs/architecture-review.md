# PGLite Table Library - Architecture Plan

## Origin

Fork from `@shotleybuilder/svelte-table-kit` (v0.15.1) to build a purpose-built data table library for PGLite/SQLite as the data engine.

## Why Fork (Not Extend)

- Array iteration and SQL queries are fundamentally different paradigms — abstracting over both creates a lowest-common-denominator interface
- PGLite's capabilities (joins, CTEs, window functions, full-text search, pgvector) exceed what FilterCondition/FilterOperator types can express
- Config in PGLite (queryable, syncable, versionable, relational) is a strict upgrade over localStorage JSON blobs
- TanStack Table becomes dead weight when using `manualFiltering`, `manualSorting`, `manualPagination` — it's just a column definition format at that point
- svelte-table-kit remains valuable for simple Svelte apps with small in-memory datasets

## Key Design Decisions

- **No TanStack Table dependency.** SQL engine IS the table engine. Column definitions become simpler metadata.
- **PGLite is the state store.** Table configs, view presets, column visibility, sort/filter state stored in PGLite tables, persisted via IndexedDB.
- **FilterBar emits SQL.** FilterConditions map to WHERE clauses. Postgres operators (regex, ILIKE, date math, JSON paths, FTS) available natively.
- **Live queries drive reactivity.** PGLite `live.query()` replaces Svelte stores for data. UI auto-updates on data changes.
- **Pagination is LIMIT/OFFSET.** Total count from `SELECT COUNT(*)`.
- **Grouping uses SQL.** `GROUP BY` with aggregation functions (SUM, AVG, COUNT).
- **Column type detection from schema introspection**, not data sampling.
- **Value suggestions via `SELECT DISTINCT`**, not row scanning.

## Component accepts PGLite instance + table name (or raw query), not a data array.

## What Carries Over from svelte-table-kit

- UI components: FilterBar, GroupBar, SortBar, ColumnMenu, CellContextMenu, RowDetailModal (rendering layer)
- Styling system: rowHeight, columnSpacing, classNames, themes
- Feature flags pattern
- AI configuration concept (TableConfig becomes SQL view definitions)
- Fuzzy search utilities (fuzzy.ts)
- Formatters (formatters.ts)

## What Gets Rewritten

- Data pipeline (SQL queries replace array iteration)
- State management (PGLite tables replace localStorage)
- Column type detection (schema introspection replaces data sampling)
- Value suggestions (SELECT DISTINCT replaces row scanning)
- Pagination (SQL-based)
- TanStack Table integration layer (removed entirely)

## Suggested Directory Structure

```
src/lib/
├── DataView.svelte          # Main component (replaces TableKit)
├── types.ts                 # Column metadata, view configs
├── query/
│   ├── builder.ts           # FilterCondition -> SQL WHERE
│   ├── live.ts              # Svelte store wrapper for PGLite live queries
│   └── schema.ts            # Introspect table schema for column types
├── state/
│   ├── views.ts             # View configs stored in PGLite table
│   └── migrations.ts        # Schema for config tables
├── components/              # Carried from svelte-table-kit
│   ├── FilterBar.svelte
│   ├── GroupBar.svelte
│   ├── SortBar.svelte
│   ├── ColumnMenu.svelte
│   ├── CellContextMenu.svelte
│   └── RowDetailModal.svelte
├── utils/                   # Carried: fuzzy.ts, formatters.ts
└── styles/                  # Carried: table-kit.css
```

## PGLite Key Facts

- Full Postgres in WASM, ~3MB gzipped
- Persistent storage via IndexedDB (`idb://` prefix)
- Live queries with reactive bindings
- ElectricSQL sync for server replication
- React hooks exist; Svelte bindings need to be built
- Relaxed durability mode for improved responsiveness

## svelte-table-kit Continues Independently

- Stable at v0.15.1 for in-memory array-based use cases
- No deprecation needed
- Ideal for simple Svelte apps with small datasets
