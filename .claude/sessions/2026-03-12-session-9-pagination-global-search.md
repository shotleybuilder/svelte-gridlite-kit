# Session 9: Pagination & Global Search

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 9

## Todo
- [ ] Review existing pagination in GridLite (LIMIT/OFFSET + COUNT already wired)
- [ ] Add page size selector UI to GridLite pagination bar
- [ ] Add global search input + `ILIKE` across text columns in query builder
- [ ] Wire global search into GridLite.svelte toolbar
- [ ] Update demo page with global search toggle
- [ ] Run type checking and tests

## Notes
- Pagination LIMIT/OFFSET + COUNT(*) already built in query/builder.ts (Session 1)
- Pagination controls already rendered in GridLite.svelte (Session 5)
- Main new work: page size selector UI, global search feature
