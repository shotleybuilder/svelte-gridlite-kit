# Title: Build Plan II — Session 6: Toolbar Layouts

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan-ii.md` — Session 6

## Research: Toolbar Patterns

### Named Patterns to Implement

**1. `airtable`** — Right-aligned horizontal toolbar (Airtable, Baserow, NocoDB)
- All controls right-aligned in a single row
- Order: Columns → Filter → Group → Sort → Row Height → Search
- Icon+text buttons
- Data controls and view controls in one row

**2. `notion`** — Minimal with controls accessed via menu/popover (Notion, Coda)
- Clean, minimal toolbar — fewer visible buttons
- Primary controls (Filter, Sort) as small text buttons
- Column/field management and grouping in a settings menu
- Search as a toggle icon that expands an input

**3. `excel`** — Stacked/ribbon style (Excel, Google Sheets)
- Two rows: primary row (Filter, Sort, Group) + secondary row (view controls, search)
- More traditional look with clear grouping
- Good for when many controls are active simultaneously

**4. `aggrid`** — Sidebar + minimal toolbar (AG Grid)
- Columns and Filters in a collapsible right-side panel
- Minimal top toolbar (just search + quick actions)
- Table fills remaining width
- Good for power-user / enterprise layouts

**5. `shadcn`** — Developer/modern (TanStack/Shadcn pattern)
- Search input left-aligned
- Faceted filter buttons in the middle
- Column visibility + actions right-aligned
- Clean, minimal, modern aesthetic

### Research Sources
- Airtable, Baserow, NocoDB: right-aligned inline toolbar
- Notion, Coda: menu-based/minimal
- Excel, Google Sheets: ribbon/stacked
- AG Grid: side panel + status bar
- TanStack/Shadcn: search-left, actions-right

## Todo
- [x] Add ToolbarLayout type to types.ts
- [x] Add toolbarLayout prop to GridLite.svelte
- [x] Implement `airtable` layout (right-aligned, reordered controls)
- [x] Implement `excel` layout (two-row stacked)
- [x] Implement `aggrid` layout (sidebar panel) — experimental, see #1
- [x] Implement `shadcn` layout (search-left, actions-right)
- [x] Refactor toolbar with semantic wrapper divs for CSS order control
- [x] CSS styles for all layouts
- [x] Normalize control heights across all button types
- [x] Add toolbar layout selector to demo page
- [x] Run type check and tests

## Notes
- `notion` deferred — too tool-specific, not a generalisable pattern
- `airtable`, `excel`, `shadcn` are CSS-driven (same HTML, CSS `order` reordering)
- `aggrid` needs separate template branch — filed as #1 for debugging
- Normalized button heights: view-control-btn now matches toggle-btn padding

**Ended**: 2026-03-12
