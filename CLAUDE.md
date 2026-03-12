# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**svelte-gridlite-kit** (`@shotleybuilder/svelte-gridlite-kit`) is a SQL-native data grid component library for Svelte and SvelteKit, powered by PGLite (Postgres in the browser via WASM). It is a purpose-built rewrite of `@shotleybuilder/svelte-table-kit`, replacing TanStack Table's in-memory row models with PGLite's SQL engine for filtering, sorting, grouping, and pagination.

**Status:** Early development — not yet published to npm.

## Development Commands

### Package Management
```bash
npm install                    # Install dependencies
```

### Development
```bash
npm run dev                    # Start dev server (Vite)
npm run build                  # Build and package the library
npm run package                # Package library (runs svelte-package + publint)
```

### Type Checking
```bash
npm run check                  # Run svelte-check once
npm run check:watch           # Run svelte-check in watch mode
```

### Testing
```bash
npm test                       # Run tests in watch mode (Vitest)
npm run test:run              # Run tests once (CI mode)
```

### Linting & Formatting
```bash
npm run lint                   # Check code with Prettier + ESLint
npm run format                 # Format code with Prettier
```

## Architecture

### Core Principle

The component accepts a **PGLite instance + table name** (or a raw SQL query), not a data array. All UI operations (filter, sort, group, paginate) translate to SQL query modifications. PGLite's live queries push reactive updates to the UI.

### Key Dependencies

| Package | Role |
|---|---|
| `@electric-sql/pglite` | Postgres WASM engine (~3MB gzipped) |
| `svelte` | Reactive UI framework |
| `@sveltejs/kit` | Dev server and packaging (dev only) |

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
| Global search | `ILIKE` or full-text search |

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

### Core Components

**GridLite.svelte** — Main data grid component
- Accepts PGLite instance + table name or raw query
- Manages SQL query construction via the query builder
- Subscribes to PGLite live queries for reactive updates
- Integrates FilterBar, GroupBar, SortBar, and column controls

**query/builder.ts** — SQL query builder
- Translates FilterCondition objects to parameterized `WHERE` clauses
- Builds complete queries with sorting, grouping, pagination
- All queries use parameterized values (no string interpolation) to prevent SQL injection

**query/live.ts** — Svelte reactive bindings for PGLite
- Wraps PGLite `live.query()` in Svelte-compatible stores
- Handles subscription lifecycle (setup/teardown)
- Provides loading and error states

**query/schema.ts** — Schema introspection
- Queries `information_schema.columns` for column types
- Maps Postgres types to UI types (text, number, date, boolean, select)
- Provides column metadata for FilterBar operator selection

**state/views.ts** — View configuration persistence
- Table configs, view presets stored as PGLite table rows
- Column visibility, ordering, sizing persisted in SQL
- Replaces localStorage-based persistence from svelte-table-kit

**state/migrations.ts** — Config table schemas
- Creates `_gridlite_views`, `_gridlite_column_state` tables on init
- Version-tracked migrations for schema evolution

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
- Test pattern: `src/**/*.{test,spec}.{js,ts}` and `tests/**/*.{test,spec}.{js,ts}`
- PGLite can be instantiated in-memory for tests (no IndexedDB needed)
- Query builder tests should verify parameterized output, not just results

## Build System

- **Package builder:** `@sveltejs/package` (svelte-package)
- **Bundler:** Vite
- **Output:** `dist/` directory
- **Validation:** publint checks package exports

## Common Patterns

### Adding a New Filter Operator
1. Add to FilterOperator type in `src/lib/types.ts`
2. Add SQL mapping in `src/lib/query/builder.ts`
3. Update FilterCondition.svelte operator dropdown
4. Add test for the SQL output

### Adding a New View State
1. Add column to config table schema in `src/lib/state/migrations.ts`
2. Add load/save logic in `src/lib/state/views.ts`
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

Example pages in `src/routes/examples/` demonstrate focused, single-feature usage:

| Route | What it demonstrates |
|---|---|
| `/examples/minimal` | Zero-config setup with auto-detected schema |
| `/examples/filtering` | FilterBar + programmatic filter buttons |
| `/examples/grouping` | Hierarchical grouping with aggregations |
| `/examples/custom-cells` | Currency, date, boolean, rating formatters |
| `/examples/raw-query` | JOIN, aggregate, CTE queries via `query` prop |

The main demo at `/` (root) shows all features together with interactive toggles.

## Common Integration Patterns

The top 5 things a Claude Code agent needs when integrating this library:

1. **PGLite must have the `live` extension.** Always create with `new PGlite({ extensions: { live } })` and cast to `PGliteWithLive`.

2. **Disable SSR.** Add `export const ssr = false;` to `+layout.ts` or `+page.ts`. Add `optimizeDeps: { exclude: ['@electric-sql/pglite'] }` to `vite.config.ts`.

3. **Table name OR raw query.** Use `table="employees"` for single-table grids, or `query="SELECT e.*, d.name AS dept_name FROM employees e JOIN departments d ON ..."` for complex queries. Never use both.

4. **Column config is optional.** If `config.columns` is omitted, GridLite introspects the schema and auto-generates columns. Provide `config.columns` when you need custom labels, formatting, or to control which columns appear.

5. **All features are opt-in via `features` prop.** Each feature (filtering, sorting, grouping, pagination, etc.) defaults to `false`. Enable only what you need.

## Relationship to svelte-table-kit

This library is a sibling to `@shotleybuilder/svelte-table-kit`, not a replacement. svelte-table-kit remains the right choice for:
- Apps without PGLite
- Simple tables with small in-memory datasets
- Projects that want TanStack Table compatibility
