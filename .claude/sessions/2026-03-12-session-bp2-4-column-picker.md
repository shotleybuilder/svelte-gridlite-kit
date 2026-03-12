# Title: Build Plan II — Session 4: Column Picker — Visibility Groups & Search

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan-ii.md` — Session 4

## Todo
- [ ] Create ColumnPicker.svelte standalone component
- [ ] Split into Visible / Hidden sections with count badges
- [ ] Add intra-control search (substring match on label + name)
- [ ] Auto-focus search on open
- [ ] Replace inline column picker in GridLite.svelte with new component
- [ ] Add CSS styles for sections, search, grab handle placeholder
- [ ] Export ColumnPicker from index.ts
- [ ] Run type check and tests

## Notes
- Extract from GridLite.svelte inline markup into dedicated component
- Props pattern matches FilterBar/SortBar/GroupBar (callbacks, not events)
- Search is substring, not fuzzy — predictable for column names
