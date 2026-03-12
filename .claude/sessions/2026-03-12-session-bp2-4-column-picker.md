# Title: Build Plan II — Session 4: Column Picker — Visibility Groups & Search

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan-ii.md` — Session 4

## Todo
- [x] Create ColumnPicker.svelte standalone component
- [x] Split into Visible / Hidden sections with count badges
- [x] Add intra-control search (substring match on label + name)
- [x] Auto-focus search on open
- [x] Replace inline column picker in GridLite.svelte with new component
- [x] Add CSS styles for sections, search, grab handle placeholder
- [x] Export ColumnPicker from index.ts
- [x] Run type check and tests

## Notes
- Extract from GridLite.svelte inline markup into dedicated component
- Props pattern matches FilterBar/SortBar/GroupBar (callbacks, not events)
- Search is substring, not fuzzy — predictable for column names
- Fixed Svelte reactivity: closures in $: statements don't track deps — inline logic or pass as params
- Fixed overflow clipping: moved overflow-x from container to table-wrap div

**Ended**: 2026-03-12
