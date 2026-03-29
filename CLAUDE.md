# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**svelte-gridlite-kit** is a SQL-native data grid component library for Svelte and SvelteKit. It is a purpose-built rewrite of `@shotleybuilder/svelte-table-kit`, replacing TanStack Table's in-memory row models with SQL-based filtering, sorting, grouping, and pagination.

**Status:** Beta — monorepo with pluggable adapter architecture.

### Packages

| Package | npm name | Description |
|---|---|---|
| `packages/core` | `@shotleybuilder/svelte-gridlite-kit` | Core grid component + query builder (no db dependency at runtime) |
| `packages/pglite` | `@shotleybuilder/gridlite-adapter-pglite` | PGLite adapter implementing `QueryAdapter` |
| `packages/demo` | (private) | Demo app with example pages |

## Development Commands

Uses **pnpm workspaces**. Run from the monorepo root.

### Package Management
```bash
pnpm install                   # Install all workspace dependencies
```

### Development
```bash
pnpm dev                       # Start demo dev server
pnpm build                     # Build all packages
pnpm package                   # Package core (svelte-package + publint)
```

### Type Checking
```bash
pnpm check                     # Run svelte-check (core) + tsc (pglite)
pnpm --filter @shotleybuilder/svelte-gridlite-kit check    # Core only
pnpm --filter @shotleybuilder/gridlite-adapter-pglite check # PGLite only
```

### Testing
```bash
pnpm test:run                  # Run all tests across all packages
pnpm --filter @shotleybuilder/svelte-gridlite-kit test:run  # Core only (180 tests)
pnpm --filter @shotleybuilder/gridlite-adapter-pglite test:run # PGLite only (64 tests)
```

### Linting & Formatting
```bash
pnpm --filter @shotleybuilder/svelte-gridlite-kit lint      # Check with Prettier + ESLint
pnpm --filter @shotleybuilder/svelte-gridlite-kit format    # Format with Prettier
```

## Architecture

### Core Principle

The component accepts a **QueryAdapter** (e.g. `createPGLiteAdapter({ db, table })`), not a data array. All UI operations (filter, sort, group, paginate) translate to SQL query modifications. The adapter executes queries and pushes reactive updates to the UI.

### Adapter Architecture

Core defines a `QueryAdapter` interface (`packages/core/src/lib/adapter.ts`). Adapters implement it:
- **PGLiteAdapter** (`packages/pglite/src/adapter.ts`) — PGLite (Postgres in WASM)
- Future: TanStack DB adapter (Phase 4)

GridLite receives `adapter` prop, builds SQL via the query builder (pure functions in core), then calls `adapter.execute(sql)` or `adapter.createLiveQuery(sql)`.

### Key Dependencies

| Package | Role |
|---|---|
| `svelte` | Reactive UI framework |
| `@sveltejs/kit` | Dev server and packaging (dev only) |
| `@electric-sql/pglite` | Postgres WASM engine (pglite adapter only) |

**No TanStack Table dependency.** The SQL engine IS the table engine.

### How Operations Map to SQL

| UI Operation | Implementation |
|---|---|
| Filtering | `WHERE` clauses via query builder |
| Sorting | `ORDER BY` |
| Grouping | `GROUP BY` with `SUM`, `AVG`, `COUNT` |
| Pagination | `LIMIT` / `OFFSET` + `SELECT COUNT(*)` |
| Value suggestions | `SELECT DISTINCT` |
| Numeric range hints | `SELECT MIN(), MAX()` |
| Column type detection | Schema introspection (`information_schema`) |
| Config persistence | PGLite tables with IndexedDB backing |
| Column labels | User-editable, persisted in `_gridlite_column_state` |
| Global search | `ILIKE` or full-text search |

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

### Core Components

**GridLite.svelte** (core) — Main data grid component
- Accepts a `QueryAdapter` via the `adapter` prop
- Builds SQL via query builder, executes through the adapter
- Subscribes to live queries for reactive updates
- Integrates FilterBar, GroupBar, SortBar, and column controls
- User-editable column labels (double-click header) with adapter-persisted state

**adapter.ts** (core) — Adapter interface definitions
- `QueryAdapter` — contract between GridLite and any database backend
- `LiveQueryHandle` — reactive query subscription (Svelte store compatible)
- `LiveQueryState` — rows, fields, loading, error state

**query/builder.ts** (core) — Pure SQL query builder
- Translates FilterCondition objects to parameterized `WHERE` clauses
- Builds complete queries with sorting, grouping, pagination
- All queries use parameterized values (no string interpolation) to prevent SQL injection

**PGLiteAdapter** (pglite) — PGLite implementation of QueryAdapter
- Wraps PGLite live queries, schema introspection, state persistence
- Created via `createPGLiteAdapter({ db, table })` or `createPGLiteAdapter({ db, query })`

### UI Components (carried from svelte-table-kit)

**FilterBar.svelte** — Advanced filtering UI
- 12+ filter operators mapped to SQL WHERE clauses
- AND/OR logic between conditions
- Collapsible UI with active filter count badge

**GroupBar.svelte** — Multi-level grouping controls
- Up to 3 nested group levels
- Maps to SQL GROUP BY with aggregation functions
- Expand/collapse functionality

**SortBar.svelte** — Sort controls
- Maps to SQL ORDER BY
- Multi-column sort support

**CellContextMenu.svelte** — Right-click context menu
- Filter by value / Exclude value actions
- Numeric columns get greater than / less than options

**RowDetailModal.svelte** — Row detail overlay
- Centered modal with backdrop
- Prev/next row navigation
- Content via named slot

### Styling System

**Row Height** (`rowHeight` prop):
- `'short'` | `'medium'` (default) | `'tall'` | `'extra_tall'`

**Column Spacing** (`columnSpacing` prop):
- `'narrow'` | `'normal'` (default) | `'wide'`

**Custom Classes** (`classNames` prop):
- Accepts partial ClassNameMap for container, table, thead, tbody, tr, th, td, etc.

### Feature Flags

Features toggled via the `features` prop:
```typescript
features={{
  columnVisibility: boolean,
  columnResizing: boolean,
  columnReordering: boolean,
  filtering: boolean,
  sorting: boolean,
  pagination: boolean,
  grouping: boolean,
  globalSearch: boolean,
  rowDetail: boolean,
  rowDetailMode: 'modal' | 'drawer' | 'inline'
}}
```

## Security

**SQL injection prevention is critical.** The query builder MUST use parameterized queries exclusively. Never interpolate user input into SQL strings. All filter values, sort columns, and pagination parameters must be parameterized or validated against schema metadata.

## Testing Strategy

- Test framework: Vitest
- **Core tests** (`packages/core/`): Query builder, pure functions — ~180 tests
- **PGLite tests** (`packages/pglite/`): Adapter, live queries, schema, migrations, views — ~64 tests
- PGLite can be instantiated in-memory for tests (no IndexedDB needed)
- Query builder tests should verify parameterized output, not just results
- Run all: `pnpm -r test:run`

## Build System

- **Monorepo:** pnpm workspaces
- **Core package:** `@sveltejs/package` (svelte-package) → `dist/`
- **PGLite adapter:** `tsc` → `dist/`
- **Demo:** Vite dev server (not published)
- **Validation:** publint checks core package exports

## Common Patterns

### Adding a New Filter Operator
1. Add to FilterOperator type in `packages/core/src/lib/types.ts`
2. Add SQL mapping in `packages/core/src/lib/query/builder.ts`
3. Update FilterCondition.svelte operator dropdown
4. Add test for the SQL output

### Adding a New View State
1. Add column to config table schema in `packages/pglite/src/migrations.ts`
2. Add load/save logic in `packages/pglite/src/views.ts`
3. Wire into GridLite.svelte state management
4. Add migration for existing databases

## Claude Code Skills

Structured reference files for integrating GridLite into a project. Located in `.claude/skills/`:

| Skill | Path | What it covers |
|---|---|---|
| Quick Start | `.claude/skills/quick-start/` | Install, PGLite init, minimal component, SvelteKit config |
| Props API | `.claude/skills/props-api/` | Complete prop reference with types, defaults, examples |
| Filtering | `.claude/skills/filtering/` | FilterBar, operators by type, programmatic filters |
| Sorting & Grouping | `.claude/skills/sorting-grouping/` | SortBar, GroupBar, multi-level grouping, aggregations |
| Column Management | `.claude/skills/column-management/` | Visibility, resizing, reordering, ColumnPicker |
| Pagination & Search | `.claude/skills/pagination-search/` | Page size, global search, SQL implementation |
| Styling | `.claude/skills/styling/` | Row height, column spacing, toolbar layouts, custom classes |
| State & Callbacks | `.claude/skills/state-callbacks/` | onStateChange, GridState, view persistence |
| Recipes | `.claude/skills/recipes/` | Custom formatters, raw query mode, common patterns |

**Usage from a consuming project:** Point Claude Code at this repository's `.claude/skills/` directory or copy the relevant SKILL.md files into your project's `.claude/skills/` folder.

## Reference Demos

Example pages in `packages/demo/src/routes/examples/` demonstrate focused, single-feature usage:

| Route | What it demonstrates |
|---|---|
| `/examples/minimal` | Zero-config setup with auto-detected schema |
| `/examples/filtering` | FilterBar + programmatic filter buttons |
| `/examples/grouping` | Hierarchical grouping with aggregations |
| `/examples/custom-cells` | Currency, date, boolean, rating formatters |
| `/examples/raw-query` | JOIN, aggregate, CTE queries via `query` prop with full toolbar |

The main demo at `/` (root) shows all features together with interactive toggles.

## Common Integration Patterns

The top 5 things a Claude Code agent needs when integrating this library:

1. **Install both packages.** `pnpm add @shotleybuilder/svelte-gridlite-kit @shotleybuilder/gridlite-adapter-pglite`. Core has the component; the adapter connects it to PGLite.

2. **Create an adapter, pass it to GridLite.** PGLite must have the `live` extension. Create with `new PGlite({ extensions: { live } })`, then `createPGLiteAdapter({ db, table: 'employees' })` for single-table or `createPGLiteAdapter({ db, query: 'SELECT ...' })` for complex queries. Pass `<GridLite {adapter} />`.

3. **Disable SSR.** Add `export const ssr = false;` to `+layout.ts` or `+page.ts`. Add `optimizeDeps: { exclude: ['@electric-sql/pglite'] }` to `vite.config.ts`.

4. **Column config is optional.** If `config.columns` is omitted, GridLite introspects the schema and auto-generates columns. Provide `config.columns` when you need custom labels, formatting, or to control which columns appear.

5. **All features are opt-in via `features` prop.** Each feature (filtering, sorting, grouping, pagination, etc.) defaults to `false`. Enable only what you need.

## Relationship to svelte-table-kit

This library is a sibling to `@shotleybuilder/svelte-table-kit`, not a replacement. svelte-table-kit remains the right choice for:
- Apps without PGLite
- Simple tables with small in-memory datasets
- Projects that want TanStack Table compatibility
