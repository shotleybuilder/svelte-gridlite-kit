# Title: Build Plan II — Session 1: Column Resizing

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan-ii.md` — Session 1

## Todo
- [ ] Add column sizing state and resize tracking vars to GridLite.svelte
- [ ] Add resize handle markup to `<th>` elements
- [ ] Implement mouse/touch event handlers (mousedown/mousemove/mouseup on window)
- [ ] Apply inline widths to `<th>` and `<td>`, add `table-layout: fixed`
- [ ] Add min/max width constraints (62px–1000px, default 180px)
- [ ] Wire columnSizing into onStateChange callback
- [ ] Add CSS styles for resize handle (.gridlite-resize-handle)
- [ ] Add columnResizing feature toggle to demo page
- [ ] Run type check and tests

## Notes
- Pure mouse/touch events — no TanStack, no external library
- Resize mode: onChange (live update during drag)
- Window-level mousemove/mouseup listeners during drag
