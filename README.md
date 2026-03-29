# svelte-gridlite-kit

A SQL-native data grid component library for Svelte and SvelteKit with pluggable database adapters.

Where traditional table libraries operate on in-memory JavaScript arrays, svelte-gridlite-kit treats a real SQL database as the table engine. Filtering becomes `WHERE` clauses. Sorting becomes `ORDER BY`. Grouping becomes `GROUP BY` with real aggregation functions. Config and view state persist in database tables — no localStorage serialization.

## Status

**Beta.** Monorepo with pluggable adapter architecture.

| Package | npm |
|---|---|
| `@shotleybuilder/svelte-gridlite-kit` | Core grid component + query builder |
| `@shotleybuilder/gridlite-adapter-pglite` | PGLite adapter (Postgres in WASM) |

## Installation

```bash
pnpm add @shotleybuilder/svelte-gridlite-kit @shotleybuilder/gridlite-adapter-pglite @electric-sql/pglite
```

## Quick Start

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { PGlite } from '@electric-sql/pglite';
  import { live } from '@electric-sql/pglite/live';
  import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
  import '@shotleybuilder/svelte-gridlite-kit/styles';
  import { createPGLiteAdapter } from '@shotleybuilder/gridlite-adapter-pglite';
  import type { QueryAdapter } from '@shotleybuilder/svelte-gridlite-kit';

  let adapter: QueryAdapter | null = null;
  let ready = false;

  onMount(async () => {
    const db = new PGlite({ extensions: { live } });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        company TEXT,
        created_at DATE DEFAULT CURRENT_DATE
      )
    `);

    // Insert some data...
    adapter = createPGLiteAdapter({ db, table: 'contacts' });
    ready = true;
  });
</script>

{#if ready && adapter}
  <GridLite
    {adapter}
    config={{
      id: 'my-contacts-grid',
      columns: [
        { name: 'name', label: 'Name' },
        { name: 'email', label: 'Email' },
        { name: 'company', label: 'Company' },
        { name: 'created_at', label: 'Created' }
      ],
      pagination: { pageSize: 25 }
    }}
    features={{
      filtering: true,
      sorting: true,
      grouping: true,
      pagination: true,
      globalSearch: true,
      rowDetail: true
    }}
  />
{/if}
```

For raw SQL queries (JOINs, CTEs, etc.):
```typescript
const adapter = createPGLiteAdapter({ db, query: 'SELECT e.*, d.name AS dept FROM employees e JOIN departments d ON ...' });
```

> **SvelteKit note:** PGLite requires browser APIs (WebAssembly, IndexedDB). Disable SSR for pages that use it:
>
> ```typescript
> // +layout.ts or +page.ts
> export const ssr = false;
> ```
>
> Also add to your `vite.config.ts`:
>
> ```typescript
> optimizeDeps: {
>   exclude: ['@electric-sql/pglite']
> }
> ```

## Guides

Structured reference docs for every feature, designed to be both human-readable and AI-agent-friendly:

- **[Quick Start](.claude/skills/quick-start/SKILL.md)** — Install, PGLite init, minimal component, SvelteKit config
- **[Props API](.claude/skills/props-api/SKILL.md)** — Complete prop reference with types, defaults, examples
- **[Filtering](.claude/skills/filtering/SKILL.md)** — FilterBar, operators by type, programmatic filter control
- **[Sorting & Grouping](.claude/skills/sorting-grouping/SKILL.md)** — SortBar, GroupBar, multi-level grouping, aggregations
- **[Column Management](.claude/skills/column-management/SKILL.md)** — Visibility, resizing, reordering, ColumnPicker
- **[Pagination & Search](.claude/skills/pagination-search/SKILL.md)** — Page size, global search, SQL implementation
- **[Styling](.claude/skills/styling/SKILL.md)** — Row height, column spacing, toolbar layouts, custom classes
- **[State & Callbacks](.claude/skills/state-callbacks/SKILL.md)** — onStateChange, GridState, view persistence
- **[Recipes](.claude/skills/recipes/SKILL.md)** — Custom formatters, raw query mode, common integration patterns

## Examples

Focused, single-feature demo pages in `packages/demo/src/routes/examples/`:

| Route | What it shows |
|---|---|
| `/examples/minimal` | Zero-config — auto-detected schema, default everything |
| `/examples/filtering` | FilterBar + programmatic filter buttons |
| `/examples/grouping` | Hierarchical grouping with aggregations |
| `/examples/custom-cells` | Currency, date, boolean, rating star formatters |
| `/examples/raw-query` | JOIN, aggregate, CTE queries via `query` prop with full toolbar |

Run `pnpm dev` and visit `http://localhost:5173/examples/minimal` to start.

## For AI Agents

This library includes structured skill files in `.claude/skills/` optimised for Claude Code and other AI coding assistants. Each skill file covers one topic with:

- Quick copy-paste examples
- Complete prop/type references
- Common patterns and troubleshooting

**To use in a consuming project:** Copy the relevant `.claude/skills/<topic>/SKILL.md` files into your project, or point your AI agent at this repository's `.claude/skills/` directory. See `CLAUDE.md` for additional architectural context and integration guidance.

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

The component accepts a **QueryAdapter** (e.g. `createPGLiteAdapter({ db, table })`), not a data array. All operations translate to SQL query modifications. The adapter executes queries and pushes reactive updates to the UI. The core package has no database dependency — adapters are separate packages.

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
| Column labels | Static config only | User-editable, persisted in PGLite |
| Global search | String matching across columns | `ILIKE` or full-text search |

### Key Design Decisions

- **No TanStack Table dependency.** The SQL engine IS the table engine.
- **Pluggable adapters.** Core defines a `QueryAdapter` interface. Database-specific code lives in adapter packages (e.g. `@shotleybuilder/gridlite-adapter-pglite`).
- **Adapter handles state persistence.** Table configs, view presets, column visibility, custom labels — all managed by the adapter.
- **FilterBar emits SQL.** Postgres operators (regex, `ILIKE`, date math, JSON paths, FTS) are available natively.
- **Live queries drive reactivity.** Adapters implement `LiveQueryHandle` for reactive subscriptions. UI auto-updates when underlying data changes.
- **Column types come from schema introspection**, not data sampling.

### Project Structure

```
packages/
├── core/src/lib/                    # @shotleybuilder/svelte-gridlite-kit
│   ├── GridLite.svelte              # Main component (uses adapter prop)
│   ├── adapter.ts                   # QueryAdapter, LiveQueryHandle interfaces
│   ├── index.ts                     # Public API exports
│   ├── types.ts                     # Column metadata, view configs, feature flags
│   ├── query/
│   │   ├── builder.ts               # FilterCondition -> SQL WHERE clause builder
│   │   └── schema.ts                # Pure type-mapping functions only
│   ├── components/                  # FilterBar, SortBar, GroupBar, etc.
│   ├── utils/                       # fuzzy.ts, formatters.ts, filters.ts
│   └── styles/gridlite.css
├── pglite/src/                      # @shotleybuilder/gridlite-adapter-pglite
│   ├── adapter.ts                   # PGLiteAdapter class
│   ├── index.ts                     # Public exports
│   ├── live.ts                      # Svelte store wrapper for PGLite live queries
│   ├── schema.ts                    # introspectTable, getColumnNames
│   ├── migrations.ts                # Config table schema creation
│   └── views.ts                     # View/column state CRUD
└── demo/src/routes/                 # Demo app (private)
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

| Package | Role | Used by |
|---|---|---|
| `svelte` | Reactive UI framework | core |
| `@sveltejs/kit` | Dev server and packaging (dev only) | core, demo |
| `@electric-sql/pglite` | Postgres WASM engine (~3MB gzipped) | pglite adapter |

## Development

```bash
pnpm install         # Install all workspace dependencies
pnpm dev             # Start demo dev server
pnpm build           # Build all packages
pnpm test:run        # Run all tests (~244)
pnpm check           # Type checking (svelte-check + tsc)
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
