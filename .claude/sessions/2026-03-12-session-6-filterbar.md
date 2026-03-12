# Session 6: FilterBar & FilterCondition Components

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 6

## Todo
- [ ] Create `src/lib/components/FilterBar.svelte` — filtering UI, emits FilterCondition[]
- [ ] Create `src/lib/components/FilterCondition.svelte` — individual filter row (column picker, operator, value)
- [ ] Wire FilterBar into GridLite.svelte
- [ ] Update demo page to enable filtering
- [ ] Update `src/lib/index.ts` — export new components

## Notes
- Operator list per column type from getOperatorsForType() (built in session 4)
- Value suggestions via SELECT DISTINCT (async, debounced)
- AND/OR logic toggle
- Reference: svelte-table-kit `FilterBar.svelte` (421 LOC), `FilterCondition.svelte` (808 LOC)
