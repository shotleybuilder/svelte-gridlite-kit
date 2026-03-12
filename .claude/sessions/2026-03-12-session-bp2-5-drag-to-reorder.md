# Title: Build Plan II — Session 5: Column Picker — Drag-to-Reorder & Multi-Select

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan-ii.md` — Session 5

## Todo
- [ ] Add drag handles (6-dot grip) to ColumnPicker items
- [ ] Implement HTML5 drag-and-drop reordering within Visible section
- [ ] Add drop indicator line between items during drag
- [ ] Cross-section drag: Hidden→Visible shows column at drop position
- [ ] Multi-select: Click, Ctrl+Click, Shift+Click selection
- [ ] Multi-column drag (move all selected as group)
- [ ] Keyboard support: Arrow keys, Space, Ctrl+A, Escape
- [ ] Wire onOrderChange callback to GridLite columnOrder state
- [ ] CSS styles for selection, drag handle, drop indicator, drag ghost
- [ ] Run type check and tests

## Notes
- Build on ColumnPicker.svelte from Session 4
- HTML5 DnD consistent with Session 2 column header reordering
- Both picker and header reorder share same columnOrder state
