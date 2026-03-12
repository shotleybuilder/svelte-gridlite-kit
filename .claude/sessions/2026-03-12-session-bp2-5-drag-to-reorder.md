# Title: Build Plan II — Session 5: Column Picker — Drag-to-Reorder & Multi-Select

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan-ii.md` — Session 5

## Todo
- [x] Add drag handles (6-dot grip) to ColumnPicker items
- [x] Implement HTML5 drag-and-drop reordering within Visible section
- [x] Add drop indicator line between items during drag
- [x] Cross-section drag: Hidden→Visible shows column at drop position
- [x] Multi-select: Click, Ctrl+Click, Shift+Click selection
- [x] Multi-column drag (move all selected as group)
- [x] Keyboard support: Arrow keys, Space, Ctrl+A, Escape
- [x] Wire onOrderChange callback to GridLite columnOrder state
- [x] CSS styles for selection, drag handle, drop indicator, drag ghost
- [x] Run type check and tests

## Notes
- Build on ColumnPicker.svelte from Session 4
- HTML5 DnD consistent with Session 2 column header reordering
- Both picker and header reorder share same columnOrder state
- Fix: pass columnOrder as explicit param to ordered() for Svelte reactivity tracking

**Ended**: 2026-03-12
