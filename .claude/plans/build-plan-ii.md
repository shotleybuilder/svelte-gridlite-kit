# svelte-gridlite-kit — Build Plan II

Continuation sessions for column interaction features. These build on the completed Build Plan I (Sessions 1–10).

## Current State

- All Build Plan I sessions complete (types, query builder, schema introspection, live queries, state persistence, utilities, GridLite main component, FilterBar, SortBar, GroupBar, context menus, column menu, row detail, pagination, global search, view controls)
- Published as v0.1.0 (not yet on npm)
- `GridFeatures` type already has `columnResizing` and `columnReordering` flags — no implementation behind them yet
- Column widths currently unmanaged (browser auto-sizing)
- Column order currently driven by `config.defaultColumnOrder` or schema order — no drag-and-drop

## Session Breakdown

---

### Session 1: Column Resizing

**Goal:** Allow users to resize columns by clicking and dragging the right edge of column headers. Column widths persist in component state and are reported via `onStateChange`.

**Deliverables:**
- Resize handle element on each column header (right edge, visible on hover)
- Mouse and touch event handling for drag-to-resize (`mousedown` → `mousemove` → `mouseup`)
- Column width state: `Record<string, number>` tracking pixel widths per column
- Minimum width constraint (62px) and maximum width constraint (1000px)
- Default column width (180px) when no explicit width is set
- Apply widths via inline `style="width: Xpx"` on `<th>` and `<td>` elements
- `table-layout: fixed` when resizing is active (required for explicit widths to work)
- Visual feedback: cursor changes to `col-resize`, thin indigo line appears on the resize handle during drag
- Wire `columnSizing` state into `onStateChange` callback
- Gate behind `features.columnResizing` flag
- CSS styles for `.gridlite-resize-handle`, `.gridlite-resize-handle:hover`, `.gridlite-resize-handle.resizing`

**Key decisions:**
- No external library — pure mouse/touch event handling (svelte-table-kit delegates to TanStack; we implement directly since we don't have TanStack)
- Resize mode: `onChange` — column width updates live during drag (not on release)
- Use `pointer-events` on the resize handle div, positioned `absolute` at the right edge of each `<th>`
- Track resize state: `resizingColumn: string | null`, `resizeStartX: number`, `resizeStartWidth: number`
- `mousemove` and `mouseup` listeners attached to `window` during drag (not the handle element) to handle cursor leaving the handle area
- Column widths stored in `columnSizing` state variable, same shape as svelte-table-kit (`Record<string, number>`)
- Future: Session 3 (state persistence) could save/load column widths via PGLite `_gridlite_column_state` table

**Files to modify:**
- `src/lib/GridLite.svelte` — Add resize handle markup, mouse/touch handlers, width state, inline styles
- `src/lib/styles/gridlite.css` — Resize handle styles
- `src/routes/+page.svelte` — Add `columnResizing` feature toggle to demo

**Reference:** svelte-table-kit `TableKit.svelte` lines 985–991 (resize handle), lines 304–330 (TanStack config), lines 1645–1675 (CSS)

---

### Session 2: Column Reordering

**Goal:** Allow users to reorder columns by dragging column headers to a new position. Uses the native HTML5 Drag and Drop API.

**Deliverables:**
- Column headers become draggable when `features.columnReordering` is enabled
- Drag and drop event handlers: `dragstart`, `dragover`, `drop`, `dragend`
- Column order state: `string[]` tracking column name order
- Visual feedback during drag: dragged column header has reduced opacity, drop target highlighted
- Order state wired into `orderedColumns` computed (replaces/augments `config.defaultColumnOrder`)
- Wire `columnOrder` state into `onStateChange` callback
- Gate behind `features.columnReordering` flag
- CSS styles for `.gridlite-th.dragging`, `.gridlite-th.drag-over`

**Key decisions:**
- Use native HTML5 Drag and Drop API — no external library (same approach as svelte-table-kit)
- `draggable="true"` on column header content div, not the `<th>` itself (avoids interfering with resize handles)
- Drag state tracked via `draggedColumnId: string | null`
- Reorder logic: splice dragged column from old position, insert at new position in `columnOrder` array
- Initialize `columnOrder` from `config.defaultColumnOrder` or from schema introspection order on first load
- When both resizing and reordering are active, the resize handle captures mousedown first (via `stopPropagation`), preventing accidental drag-start
- Cursor: `grab` on hover, `grabbing` during drag
- Future: persistence via PGLite `_gridlite_column_state` table

**Files to modify:**
- `src/lib/GridLite.svelte` — Add drag/drop handlers, column order state, draggable attributes, visual feedback classes
- `src/lib/styles/gridlite.css` — Drag feedback styles
- `src/routes/+page.svelte` — Add `columnReordering` feature toggle to demo

**Reference:** svelte-table-kit `TableKit.svelte` lines 417–445 (drag handlers), lines 878–896 (HTML template), lines 1549–1551 (CSS)

---

### Session 3: Grouped View Overhaul

**Goal:** Replace the current SQL `GROUP BY` rendering (which collapses rows into flat summaries) with a proper grouped view: collapsible section headers with child rows underneath. Group headers span the full table width, eliminating the wasted whitespace that plagues svelte-table-kit and matching the pattern used by MS Lists, Airtable, and Notion.

**Problem today:**
- Grouping on "Department" produces a `GROUP BY department` query that returns 8 summary rows (one per department) with only the department column populated — all other columns are blank
- No expand/collapse — there are no child rows to expand
- No count badges, no aggregation summaries
- Grouped columns still occupy their own table column, wasting horizontal space

**New approach — two-query strategy:**
1. **Group summary query:** `SELECT department, COUNT(*) AS _count FROM employees GROUP BY department ORDER BY department` — fetches the distinct group values and counts
2. **Detail query:** The existing full query (with filters, sorting, pagination) but with an added `WHERE department = $N` for each expanded group — fetches child rows on demand

This avoids loading all rows upfront. Only expanded groups fetch their children.

**Deliverables:**

*Query layer:*
- `src/lib/query/builder.ts` — Add `buildGroupSummaryQuery()` function: returns group values + COUNT(*) + optional aggregations for the group columns. Parameterized, validates column names
- `src/lib/query/builder.ts` — Add `buildGroupDetailQuery()` function: the full query with an additional WHERE clause constraining the grouped column(s) to a specific value. Supports multi-level grouping (nested groups)
- `src/lib/query/builder.test.ts` — Tests for both new functions, including multi-level groups and parameterized output

*Component state:*
- `src/lib/GridLite.svelte` — New state: `groupData: GroupRow[]` (array of `{ values: Record<string, unknown>, count: number, expanded: boolean, children: Record<string, unknown>[] | null }`)
- Expand/collapse logic: clicking a group header toggles `expanded`, triggers `buildGroupDetailQuery()` to fetch children (or clears them on collapse)
- `expandedGroups: Set<string>` keyed by group value (or composite key for multi-level)

*Template — full-width group headers:*
- When grouping is active, render a completely different table body layout:
  - **Group header row:** `<tr class="gridlite-group-row">` containing a single `<td colspan={orderedColumns.length}>` that spans the full table width. Inside: expand/collapse chevron, group value label, row count badge, optional aggregation chips (e.g. "Avg Salary: $72,500")
  - **Child rows:** Standard data rows rendered below the group header, but **excluding the grouped column(s)** from the visible columns — the group value is already shown in the header, so repeating it in every child row is redundant
  - **Collapsed groups:** Only the header row; no child rows rendered
- The grouped column is **removed from the column headers** (`<thead>`) when grouping is active, reclaiming horizontal space
- Indentation for nested groups: each nesting level adds left padding to the group header

*CSS styles:*
- `.gridlite-group-row` — subtle background (#f8f9fa), full-width td, font-weight 600
- `.gridlite-group-header` — flex layout: chevron + label + count badge + aggregation chips
- `.gridlite-group-chevron` — rotate transition (0° collapsed → 90° expanded)
- `.gridlite-group-count` — muted badge with count
- `.gridlite-group-agg` — small pill for aggregation values
- Nesting indentation: `.gridlite-group-level-0`, `.gridlite-group-level-1`, `.gridlite-group-level-2`

*Demo:*
- `src/routes/+page.svelte` — Grouping toggle already exists; verify it works with the new rendering

**Key decisions:**
- **Full-width group headers (not column-aligned):** This is the critical UX improvement over svelte-table-kit. Group headers use `colspan` to span the entire row width. The group value, count, and aggregations are rendered in a single flex container — no wasted columns
- **Grouped columns hidden from child rows:** When grouping by Department, the Department column disappears from the table headers and data rows. Every child row under "Engineering (8)" is obviously in Engineering — showing it again is noise
- **Lazy child loading:** Child rows are fetched only when a group is expanded (not all at once). This scales to large datasets — 10,000 rows grouped into 50 groups only loads the children of expanded groups
- **Pagination interaction:** When grouping is active, pagination applies to group headers, not child rows. Page 1 shows N groups (each with their expanded children). The total count reflects the number of groups
- **No live query for group detail:** Group detail queries use `db.query()` (one-shot), not `live.query()`. The top-level group summary can remain live, but child rows are fetched imperatively on expand. This avoids managing dozens of live subscriptions
- **Multi-level grouping (max 3 levels, like Airtable):** For 2+ group levels, the group summary query groups by all columns. Expanding a top-level group runs a sub-summary query for the next level. Child rows only appear at the deepest level. Hard limit of 3 group levels enforced in GroupBar and programmatic API
- **Aggregation display:** If `GroupConfig.aggregations` are specified, the group header shows the aggregated values as small pills next to the count badge

**Files to modify:**
- `src/lib/query/builder.ts` — Add `buildGroupSummaryQuery()`, `buildGroupDetailQuery()`
- `src/lib/query/builder.test.ts` — Tests for new query functions
- `src/lib/GridLite.svelte` — Grouped view state, expand/collapse logic, grouped template rendering
- `src/lib/styles/gridlite.css` — Group header styles
- `src/routes/+page.svelte` — Verify demo works with new grouping

**Reference:** svelte-table-kit `TableKit.svelte` lines 999–1082 (grouped row rendering — but we diverge significantly with full-width headers and column hiding). MS Lists and Airtable grouped views for UX inspiration.

---

### Session 4: Column Picker — Visibility Groups & Search

**Goal:** Upgrade the column picker dropdown from a flat checkbox list into a structured panel with visible/hidden grouping and an intra-control search filter. This is the foundation for the Airtable-style column management experience.

**Problem today:**
- The column picker is a flat list of checkboxes — all columns shown in schema order regardless of visibility state
- With 20+ columns the list becomes unwieldy — no way to find a column without scrolling
- No visual distinction between visible and hidden columns
- Show All / Hide All buttons exist but the list doesn't reflect the grouping

**Deliverables:**

*Extract to standalone component:*
- `src/lib/components/ColumnPicker.svelte` — Extract the column picker from its inline position in GridLite.svelte into a dedicated component. This is necessary because Sessions 4–5 add significant complexity (search, drag-and-drop, multi-select) that would bloat GridLite.svelte
- Props: `columns: ColumnMetadata[]`, `columnConfigs: ColumnConfig[]`, `columnVisibility: Record<string, boolean>`, `columnOrder: string[]`, `isOpen: boolean`, `onVisibilityChange: (column, visible) => void`, `onToggleAll: (show: boolean) => void`, `onOrderChange: (newOrder: string[]) => void`, `onClose: () => void`

*Visible / Hidden grouping:*
- Split the column list into two sections: **Visible Columns** (checked) and **Hidden Columns** (unchecked)
- Each section has a header label with a count badge (e.g. "Visible (8)", "Hidden (2)")
- Toggling a column's checkbox moves it between sections with a smooth transition
- Show All moves everything to Visible; Hide All moves everything to Hidden
- Within each section, columns maintain their current order (from `columnOrder` or schema order)

*Intra-control search:*
- Search input at the top of the picker panel, with a magnifying glass icon and clear button
- Filters both Visible and Hidden sections simultaneously — non-matching columns are hidden
- Search matches against column label (from config) and column name (from schema)
- Case-insensitive substring match (not fuzzy — keep it simple and predictable)
- Empty search shows all columns
- Search input auto-focuses when the picker opens

*CSS styles:*
- `.gridlite-column-picker-search` — Search input styling (matches global search input pattern)
- `.gridlite-column-picker-section` — Section container
- `.gridlite-column-picker-section-header` — Section label + count badge
- Updated `.gridlite-column-picker-item` — Add grab handle placeholder (visual only in this session, functional in Session 5)

**Key decisions:**
- **Standalone component:** The picker is growing complex enough to warrant its own file. GridLite.svelte passes state and callbacks via props, same pattern as FilterBar/SortBar/GroupBar
- **Two sections, not tabs:** Both Visible and Hidden are shown simultaneously (scrollable), so users can see the full picture without switching views. This matches Airtable's approach
- **Search is local filtering, not fuzzy:** The column list is finite and the user knows what they're looking for. Substring match is more predictable than fuzzy scoring for this use case
- **Column order prop:** The picker receives and respects `columnOrder` so that column positions are consistent between the picker and the table. Changes to order are communicated back via `onOrderChange` (used in Session 5)

**Files to create:**
- `src/lib/components/ColumnPicker.svelte`

**Files to modify:**
- `src/lib/GridLite.svelte` — Replace inline column picker markup with `<ColumnPicker>` component, wire props
- `src/lib/styles/gridlite.css` — New section styles, search input styles
- `src/lib/index.ts` — Export ColumnPicker component

---

### Session 5: Column Picker — Drag-to-Reorder & Multi-Select

**Goal:** Add drag-and-drop reordering within the column picker panel, including multi-column selection and batch moves. Dragging columns in the picker reorders them in the table.

**Deliverables:**

*Single-column drag-to-reorder:*
- Each column item in the picker gets a drag handle (6-dot grip icon on the left)
- Drag handle uses HTML5 Drag and Drop API (consistent with Session 2's column header reordering)
- Dragging a column item within the Visible section reorders it — the table column order updates in real-time
- Dragging from Visible to Hidden hides the column; dragging from Hidden to Visible shows it
- Drop indicator: a horizontal line appears between items showing where the column will land
- Smooth reorder animation using CSS transitions on the list items

*Multi-select:*
- Click selects a single column item (highlighted background)
- Ctrl+Click (Cmd+Click on Mac) adds/removes individual items from the selection
- Shift+Click selects a range from the last-clicked item to the current item
- Selected items highlighted with a distinct background color
- Selected count shown in a floating badge or status text (e.g. "3 selected")

*Multi-column drag:*
- When multiple columns are selected, dragging any selected item moves all selected items as a group
- During drag, a badge shows the count being moved (e.g. ghost shows "3 columns")
- Drop inserts all selected columns at the drop position, maintaining their relative order
- After drop, selection is preserved on the moved items

*Keyboard support:*
- Arrow Up/Down navigates the column list
- Space toggles visibility of the focused column
- Ctrl+A selects all columns in the current section
- Escape clears selection and closes picker

*CSS styles:*
- `.gridlite-column-picker-item.selected` — Multi-select highlight
- `.gridlite-column-picker-drag-handle` — 6-dot grip icon
- `.gridlite-column-picker-drop-indicator` — Horizontal line between items during drag
- `.gridlite-column-picker-drag-ghost` — Custom drag image with count badge

**Key decisions:**
- **Drag handle, not full-row drag:** The drag handle is a dedicated grip icon area. Clicking the checkbox toggles visibility; clicking the label selects; dragging the handle reorders. Clear affordances for each action
- **HTML5 Drag and Drop (not pointer events):** Consistent with Session 2. The picker is a list, not a grid, so HTML5 DnD works well. `dragstart` sets the payload (column name or array of names), `dragover` shows the drop indicator, `drop` triggers the reorder
- **Cross-section drag:** Dragging from Hidden to Visible both shows the column and positions it at the drop point. This is more intuitive than separate show + reorder steps
- **Multi-select model:** Standard OS selection conventions (Click, Ctrl+Click, Shift+Click). Selection state is local to the picker — not persisted
- **Order syncs bidirectionally:** Reordering in the picker updates `columnOrder` state in GridLite, which also drives the table header order. If Session 2 (column header drag) is implemented, both the picker and the headers modify the same `columnOrder` array
- **Reorder within section only (initially):** Single-column drag reorders within Visible or moves between sections. Multi-column drag follows the same rules. No reordering within the Hidden section (hidden column order doesn't affect the table)

**Files to modify:**
- `src/lib/components/ColumnPicker.svelte` — Drag handles, drag/drop handlers, multi-select state, keyboard handlers
- `src/lib/styles/gridlite.css` — Drag handle, drop indicator, selection styles, drag ghost
- `src/lib/GridLite.svelte` — Wire `onOrderChange` callback to update `columnOrder` state

**Reference:** Airtable's column picker (Fields sidebar) for UX. HTML5 Drag and Drop API for implementation pattern.

---

ru### Session 6: Toolbar Layouts

**Goal:** Offer configurable toolbar layout presets that control how the controls above the table (Filter, Sort, Group, Search, View Controls) are arranged. Different layouts suit different screen sizes, data densities, and user preferences.

**Problem today:**
- The toolbar is a single `flex-wrap` row — all controls sit inline and wrap when they overflow
- On narrow screens or when many controls are enabled, the toolbar becomes messy — controls jump between lines unpredictably
- No way for the consuming developer to choose a layout that suits their app's design
- The view controls (row height, column spacing, columns) always sit at the far right, which works for wide screens but not for stacked layouts

**Layout presets:**

1. **`inline`** (current default) — All controls in a single horizontal row with flex-wrap. Filter, Sort, Group buttons on the left; search and view controls on the right. Good for wide screens with few active controls.

2. **`stacked`** — Two rows: top row has Filter/Sort/Group buttons + search; bottom row has view controls (row height, column spacing, columns). Clean separation between data controls and view controls. Good for medium-width layouts.

3. **`compact`** — All controls collapsed into icon-only buttons (no text labels) in a single row. Tooltips reveal the control names on hover. Maximises vertical space for the data grid. Good for dashboard embeds or space-constrained layouts.

4. **`sidebar`** — Controls rendered vertically in a narrow panel to the left of the table, rather than above it. Filter/Sort/Group as stacked sections, view controls at the bottom. The table fills the remaining width. Good for full-page data views (like Airtable's left sidebar pattern).

**Deliverables:**

*New prop:*
- `toolbarLayout: 'inline' | 'stacked' | 'compact' | 'sidebar'` — defaults to `'inline'` (backwards compatible)
- Add `ToolbarLayout` type to `src/lib/types.ts`
- Add to `GridLiteProps` interface and `GridFeatures` or as a top-level prop

*Template changes:*
- `src/lib/GridLite.svelte` — Wrap the toolbar in a layout container div with a class per layout (`gridlite-toolbar-inline`, `gridlite-toolbar-stacked`, `gridlite-toolbar-compact`, `gridlite-toolbar-sidebar`)
- **Inline:** Current markup, minimal changes — just add the layout class
- **Stacked:** Split the toolbar into two divs: `.gridlite-toolbar-row-primary` (filter/sort/group + search) and `.gridlite-toolbar-row-secondary` (view controls)
- **Compact:** Same structure as inline but all buttons get an `.icon-only` class — text labels hidden via CSS, SVG icons remain, buttons shrink. The FilterBar/SortBar/GroupBar toggle buttons become icon-only (the expanded panels still show full text)
- **Sidebar:** Restructure from `<div class="gridlite-toolbar"> + <table>` into a flex container: `<div class="gridlite-layout-sidebar">` containing `<aside class="gridlite-sidebar">` (controls) + `<div class="gridlite-main">` (table + pagination)

*CSS styles:*
- `.gridlite-toolbar-inline` — Current flex-wrap styles (refactored from `.gridlite-toolbar`)
- `.gridlite-toolbar-stacked` — Column flex direction, two rows
- `.gridlite-toolbar-compact` — Tighter gaps, icon-only button overrides, tooltip styling
- `.gridlite-toolbar-sidebar` — Not a toolbar class but a layout wrapper. Sidebar as `flex-shrink: 0; width: 220px; border-right`, main as `flex: 1; overflow-x: auto`
- `.gridlite-toolbar .icon-only` — Hide text labels, show only SVG icons
- Responsive: compact layout auto-kicks in below a configurable breakpoint (optional, via CSS `@container` or `@media`)

*Demo:*
- `src/routes/+page.svelte` — Add toolbar layout selector (dropdown) to the demo controls

**Key decisions:**
- **Prop, not feature flag:** `toolbarLayout` is a styling/layout choice, not a functional toggle. It's a top-level prop like `rowHeight` and `columnSpacing`, not inside `features`
- **CSS-driven, not template-driven:** Inline, stacked, and compact all use the same HTML structure — only CSS changes. Sidebar requires a minor template restructure (wrapping div). This keeps the Svelte logic simple
- **Compact shows tooltips:** Since text labels are hidden, every button gets a `title` attribute for native browser tooltips. No custom tooltip component needed
- **Sidebar is optional complexity:** If sidebar proves too complex for one session, it can be deferred. The other three layouts (inline, stacked, compact) are pure CSS and low-risk

**Files to modify:**
- `src/lib/types.ts` — Add `ToolbarLayout` type
- `src/lib/GridLite.svelte` — Add `toolbarLayout` prop, layout container classes, sidebar template variant
- `src/lib/styles/gridlite.css` — Layout-specific styles
- `src/routes/+page.svelte` — Layout selector in demo

---

### Session 7: Developer Experience — SKILL.md Files, Reference Demos & Integration Guide

**Goal:** Make it effortless for Claude Code (and human developers) to integrate svelte-gridlite-kit into a project. Create structured SKILL.md reference files that Claude Code can consume as context, and upgrade the demo app to serve as copy-pasteable reference code for every feature.

**Problem today:**
- CLAUDE.md describes the architecture and project structure but doesn't explain *how to use* the library from a consuming project's perspective
- The demo pages are developer test harnesses, not integration references — they lack comments, don't show common patterns, and aren't structured for copy-paste
- A new Claude Code session working on a consuming project has no quick reference for props, features, config patterns, or common recipes
- No SKILL.md files exist — Claude Code can't quickly look up "how do I add filtering to GridLite?" without reading the full source

**Deliverables:**

*SKILL.md reference files (in `docs/skills/`):*

- `docs/skills/quick-start.md` — Minimal setup: install, PGLite init, basic GridLite with table name, SvelteKit SSR/Vite config. The "copy this and it works" file
- `docs/skills/props-api.md` — Complete prop reference for GridLite: every prop with type, default, description, and a short usage example. Includes `GridConfig`, `GridFeatures`, `ClassNameMap`, `RowHeight`, `ColumnSpacing`, `ToolbarLayout`
- `docs/skills/filtering.md` — FilterBar integration: enabling the feature, default filters, filter operators by column type, programmatic filter control via `setFilters()`, AND/OR logic
- `docs/skills/sorting-grouping.md` — SortBar and GroupBar: enabling, defaults, programmatic control, multi-level grouping with aggregations
- `docs/skills/column-management.md` — Column visibility, ordering, resizing: feature flags, default configs, programmatic control, ColumnPicker integration
- `docs/skills/pagination-search.md` — Pagination config, page size options, global search setup, search across specific columns
- `docs/skills/styling.md` — Row height, column spacing, toolbar layouts, custom CSS classes via `classNames`, theming patterns, CSS variable overrides
- `docs/skills/state-callbacks.md` — `onStateChange` callback, `GridState` shape, reading current state, view presets, state persistence via PGLite tables
- `docs/skills/recipes.md` — Common integration patterns: custom cell formatters, right-click context menu actions, row detail modal with custom content, connecting to an existing PGLite instance, raw query mode, programmatic refresh

*Each SKILL.md follows a consistent format:*
```markdown
# [Topic Name]

## Overview
One-paragraph summary of what this covers.

## Quick Example
Minimal code example that works standalone.

## Props / Config
Table of relevant props with types and defaults.

## Common Patterns
2-3 annotated code blocks showing typical usage.

## API Reference
Functions, types, and callbacks relevant to this topic.

## Troubleshooting
Common mistakes and how to fix them.
```

*Demo app upgrades:*

- `src/routes/+page.svelte` — Refactor into a **well-commented reference implementation**:
  - Section comments explaining each part: PGLite setup, table creation, seed data, GridLite config, feature flags, event handlers
  - Every prop and feature demonstrated with a comment explaining what it does
  - Structured so a developer (or Claude Code) can copy specific sections

- `src/routes/examples/filtering/+page.svelte` — Focused demo: filtering only, with pre-set filters, programmatic filter control buttons
- `src/routes/examples/grouping/+page.svelte` — Focused demo: grouping with expand/collapse, aggregations, multi-level
- `src/routes/examples/minimal/+page.svelte` — Absolute minimum: PGLite + GridLite with zero config (schema auto-detection, default everything)
- `src/routes/examples/custom-cells/+page.svelte` — Custom cell formatters, currency/date formatting, conditional styling
- `src/routes/examples/raw-query/+page.svelte` — Using `query` prop instead of `table`, joining multiple tables

*Update CLAUDE.md:*
- Add a "Developer Skills" section pointing to `docs/skills/*.md`
- Add a "Reference Demos" section listing the example routes and what each demonstrates
- Add a "Common Integration Patterns" section with the top 5 things a Claude Code agent needs to know when integrating the library

*Update README.md:*
- Expand the Quick Start section with a more complete example
- Add links to the SKILL.md files as "Guides"
- Add a "For AI Agents" section explaining the docs/skills/ structure

**Key decisions:**
- **`docs/skills/` not `docs/api/`:** The term "skills" aligns with Claude Code's skill system. These files are optimised for LLM consumption — concise, example-heavy, with clear structure. They're also perfectly readable by humans
- **Focused example pages, not one mega demo:** Each example page demonstrates one feature in isolation. This makes it easy to copy the relevant pattern without parsing a complex multi-feature demo
- **Comments in demo code are the documentation:** Rather than maintaining separate prose docs that drift from the code, the demo pages themselves are the reference. Heavy inline comments explain the "why" alongside the "what"
- **CLAUDE.md as the index:** A Claude Code agent working on a consuming project can be pointed at the gridlite-kit CLAUDE.md, which links to the relevant skill files. The agent doesn't need to read source code to integrate the library
- **No auto-generated API docs:** Hand-written skill files are more useful than auto-generated TSDoc. They show patterns and recipes, not just signatures

**Files to create:**
- `docs/skills/quick-start.md`
- `docs/skills/props-api.md`
- `docs/skills/filtering.md`
- `docs/skills/sorting-grouping.md`
- `docs/skills/column-management.md`
- `docs/skills/pagination-search.md`
- `docs/skills/styling.md`
- `docs/skills/state-callbacks.md`
- `docs/skills/recipes.md`
- `src/routes/examples/filtering/+page.svelte`
- `src/routes/examples/grouping/+page.svelte`
- `src/routes/examples/minimal/+page.svelte`
- `src/routes/examples/custom-cells/+page.svelte`
- `src/routes/examples/raw-query/+page.svelte`

**Files to modify:**
- `src/routes/+page.svelte` — Refactor with comprehensive comments
- `CLAUDE.md` — Add skill file references and integration guidance
- `README.md` — Expand quick start, add guide links

**Reference:** Airtable API docs, Shadcn/ui component docs, TanStack Table guides for tone and structure.

---

## Dependency Graph

```
Build Plan I (complete)
├── Session 1 (column resizing)
│   └── Session 2 (column reordering)
├── Session 3 (grouped view overhaul)
├── Session 4 (column picker: visibility groups & search)
│   └── Session 5 (column picker: drag reorder & multi-select)
├── Session 6 (toolbar layouts)
└── Session 7 (developer experience: skills, demos, docs)
```

Session 2 depends on Session 1 because:
- Both modify the `<th>` template — resizing adds a handle div, reordering adds draggable attributes
- When both are active, resize handle must capture events before drag-start fires
- The `orderedColumns` computed needs to be stable before adding drag-drop mutations

Session 3 is independent of Sessions 1–2 and 4–5 (different area of the component).

Session 5 depends on Session 4 because:
- Session 4 extracts the picker into a standalone component and adds the section structure
- Session 5 adds drag-and-drop and multi-select on top of that structure
- The `columnOrder` prop wiring from Session 4 is the foundation for Session 5's reorder callbacks

Sessions 2 and 5 share the `columnOrder` state — if both are implemented, reordering in either the column headers or the picker updates the same array.

Session 6 is independent of all other sessions (purely CSS/layout concerns).

Session 7 depends on all prior sessions being complete — it documents the final API surface, creates reference demos for all features, and writes skill files covering the full library. Should be the last session implemented.

---

## Estimated Scope

- 7 sessions
- Sessions 1–2: ~200–300 LOC each (handlers, state, template, CSS)
- Session 3: ~400–500 LOC (query functions, grouped rendering, expand/collapse state, CSS)
- Session 4: ~250–350 LOC (new component extraction, section layout, search, CSS)
- Session 5: ~300–400 LOC (drag/drop, multi-select, keyboard, CSS)
- Session 6: ~200–300 LOC (layout CSS, minor template restructure, type additions)
- Session 7: ~1,500–2,000 LOC across 14 new files (9 skill docs + 5 example pages) plus modifications to 3 existing files
- New component files: `ColumnPicker.svelte`
- New doc files: 9 skill files in `docs/skills/`
- New example pages: 5 routes in `src/routes/examples/`
- No new dependencies

---

## Future Consideration: Views System (svelte-table-views-tanstack)

`svelte-table-views-tanstack` is a sibling library that allows users to save and restore table configuration as named views (column visibility, ordering, sizing, filters, sorts, grouping). It currently targets TanStack Table's state model.

For svelte-gridlite-kit, this library would need forking/adapting to:
- Replace TanStack state shapes with GridLite's `GridState` interface
- Persist views to PGLite tables (`_gridlite_views`) instead of localStorage
- Wire into GridLite's `onStateChange` callback for save and `config.presets` / programmatic setters for restore
- The `ViewPreset` type already exists in `src/lib/types.ts` and `state/views.ts` has basic CRUD — a views UI component would build on this foundation

This is out of scope for Build Plan II but should be considered as a future session or separate companion library (`svelte-gridlite-views`).
