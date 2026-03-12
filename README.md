# svelte-gridlite-kit

A SQL-native data grid component library for Svelte and SvelteKit, powered by [PGLite](https://pglite.dev/) (Postgres in the browser via WASM).

Where traditional table libraries operate on in-memory JavaScript arrays, svelte-gridlite-kit treats a real SQL database as the table engine. Filtering becomes `WHERE` clauses. Sorting becomes `ORDER BY`. Grouping becomes `GROUP BY` with real aggregation functions. Config and view state persist in PGLite tables backed by IndexedDB — no localStorage serialization.

## Status

**Early development.** Not yet published to npm.

## Origin

Forked from [`@shotleybuilder/svelte-table-kit`](https://github.com/shotleybuilder/svelte-table-kit) (v0.15.1), a TanStack Table-based data table library. The architectural shift to PGLite as a local-first data layer meant the in-memory array paradigm and TanStack Table's client-side row models were no longer the right foundation. This is a purpose-built rewrite for the SQL-native stack.

See [Architecture](#architecture) below for the full rationale.

## Why Not Extend svelte-table-kit?

- **Different paradigms.** Array iteration and SQL queries aren't two implementations of the same abstraction — they're fundamentally different data models. Abstracting over both creates a lowest-common-denominator interface that limits both.
- **PGLite exceeds what FilterCondition can express.** Joins, CTEs, window functions, full-text search, pgvector — none of these work through a `FilterCondition[]` interface.
- **TanStack Table becomes dead weight.** With `manualFiltering`, `manualSorting`, `manualPagination`, it's just a column definition format and rendering loop.
- **Config in PGLite is a strict upgrade.** Queryable, syncable, versionable, relational config storage vs flat JSON blobs in localStorage.
- **svelte-table-kit remains valuable.** Not every project needs a 3MB WASM Postgres. For simple Svelte apps with small in-memory datasets, it's the right tool.

## Architecture

### Core Principle

The component accepts a **PGLite instance + table name** (or a raw SQL query), not a data array. All operations translate to SQL query modifications. PGLite's live queries push reactive updates to the UI.

### How Operations Map to SQL

| UI Operation | svelte-table-kit (old) | svelte-gridlite-kit |
|---|---|---|
| Filtering | `applyFilters()` iterates JS array | `WHERE` clauses |
| Sorting | TanStack `getSortedRowModel()` | `ORDER BY` |
| Grouping | TanStack `getGroupedRowModel()` | `GROUP BY` with `SUM`, `AVG`, `COUNT` |
| Pagination | TanStack `getPaginationRowModel()` | `LIMIT` / `OFFSET` + `SELECT COUNT(*)` |
| Value suggestions | Scan all rows for unique values | `SELECT DISTINCT` |
| Numeric range hints | Scan all rows for min/max | `SELECT MIN(), MAX()` |
| Column type detection | Sample rows and guess | Schema introspection |
| Config persistence | localStorage JSON | PGLite tables with IndexedDB backing |
| Global search | String matching across columns | `ILIKE` or full-text search |

### Key Design Decisions

- **No TanStack Table dependency.** The SQL engine IS the table engine.
- **PGLite is the state store.** Table configs, view presets, column visibility, sort/filter state — all stored in PGLite tables, persisted automatically via IndexedDB.
- **FilterBar emits SQL.** Postgres operators (regex, `ILIKE`, date math, JSON paths, FTS) are available natively.
- **Live queries drive reactivity.** PGLite `live.query()` replaces Svelte writable stores for data. UI auto-updates when underlying data changes.
- **Column types come from schema introspection**, not data sampling.
- **ElectricSQL sync is native** for multi-device, offline-first use cases.

### Project Structure

```
src/lib/
├── GridLite.svelte          # Main component
├── index.ts                 # Public API exports
├── types.ts                 # Column metadata, view configs, feature flags
├── query/
│   ├── builder.ts           # FilterCondition -> SQL WHERE clause builder
│   ├── live.ts              # Svelte store wrapper for PGLite live queries
│   └── schema.ts            # Table schema introspection for column types
├── state/
│   ├── views.ts             # View configs stored in PGLite tables
│   └── migrations.ts        # Schema definitions for config tables
├── components/
│   ├── FilterBar.svelte     # Advanced filtering UI
│   ├── GroupBar.svelte      # Multi-level grouping controls
│   ├── SortBar.svelte       # Sort controls
│   ├── ColumnMenu.svelte    # Column context menu
│   ├── CellContextMenu.svelte  # Right-click cell actions
│   └── RowDetailModal.svelte   # Row detail overlay
├── utils/
│   ├── fuzzy.ts             # Fuzzy search with scoring
│   └── formatters.ts        # Date, currency, number formatters
└── styles/
    └── gridlite.css         # Default styles
```

### What Carries Over from svelte-table-kit

- **UI components** — FilterBar, GroupBar, SortBar, ColumnMenu, CellContextMenu, RowDetailModal (rendering layer, adapted for SQL-backed data)
- **Styling system** — rowHeight, columnSpacing, classNames, themes
- **Feature flags pattern** — boolean toggles for enabling/disabling functionality
- **AI configuration concept** — TableConfig becomes SQL view definitions
- **Utilities** — fuzzy search, value formatters

### What Gets Rewritten

- Data pipeline (SQL queries replace array iteration)
- State management (PGLite tables replace localStorage)
- Column type detection (schema introspection replaces data sampling)
- Value suggestions (`SELECT DISTINCT` replaces row scanning)
- Pagination (SQL-based)
- TanStack Table integration layer (removed entirely)
- Svelte reactive bindings for PGLite live queries (new — no existing Svelte hooks)

## Dependencies

| Package | Role |
|---|---|
| `@electric-sql/pglite` | Postgres WASM engine (~3MB gzipped) |
| `svelte` | Reactive UI framework |
| `@sveltejs/kit` | Dev server and packaging (dev only) |

## Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build library
npm run package      # Package for npm
npm run check        # Type checking
npm test             # Run tests
```

## PGLite Quick Reference

```typescript
import { PGlite } from '@electric-sql/pglite';

// Ephemeral (in-memory)
const db = new PGlite();

// Persistent (IndexedDB)
const db = new PGlite('idb://my-app-db');

// Live query (reactive)
const result = await db.live.query('SELECT * FROM users WHERE active = true');
```

See [PGLite docs](https://pglite.dev/docs/) for full API reference.

## Related

- [`@shotleybuilder/svelte-table-kit`](https://github.com/shotleybuilder/svelte-table-kit) — In-memory array-based data table for Svelte (TanStack Table)
- [PGLite](https://pglite.dev/) — Embeddable Postgres with reactive bindings
- [ElectricSQL](https://electric-sql.com/) — Local-first sync for Postgres

## License

MIT
