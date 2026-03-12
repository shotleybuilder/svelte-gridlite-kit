# Title: Build Plan II — Session 2: Column Reordering

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan-ii.md` — Session 2

## Todo
- [x] Add column order state and drag tracking vars to GridLite.svelte
- [x] Update orderedColumns computed to use columnOrder state
- [x] Add drag/drop event handlers (dragstart, dragover, drop, dragend)
- [x] Add draggable attribute and drag classes to <th> content
- [x] Ensure resize handle captures mousedown before drag-start
- [x] Add CSS styles for drag feedback (.dragging, .drag-over)
- [x] Add columnReordering feature toggle to demo page
- [x] Run type check and tests

## Notes
- HTML5 Drag and Drop API — no external library
- draggable on th-content div, not the <th> itself (avoids resize handle conflict)
- Shares columnOrder state with future ColumnPicker (Session 5)
- 0 type errors, 0 warnings, 134 tests passing

**Ended**: 2026-03-12T17:12:00Z
