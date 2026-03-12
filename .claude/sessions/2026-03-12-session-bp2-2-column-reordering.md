# Title: Build Plan II — Session 2: Column Reordering

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan-ii.md` — Session 2

## Todo
- [ ] Add column order state and drag tracking vars to GridLite.svelte
- [ ] Update orderedColumns computed to use columnOrder state
- [ ] Add drag/drop event handlers (dragstart, dragover, drop, dragend)
- [ ] Add draggable attribute and drag classes to <th> content
- [ ] Ensure resize handle captures mousedown before drag-start
- [ ] Add CSS styles for drag feedback (.dragging, .drag-over)
- [ ] Add columnReordering feature toggle to demo page
- [ ] Run type check and tests

## Notes
- HTML5 Drag and Drop API — no external library
- draggable on th-content div, not the <th> itself (avoids resize handle conflict)
- Shares columnOrder state with future ColumnPicker (Session 5)
