# Session 5a: Dev Demo App

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 5a

## Todo
- [ ] Expand `src/routes/+page.svelte` — full demo with feature flag toggles, 50-100 rows
- [ ] Create `src/routes/+layout.svelte` — minimal layout with nav
- [ ] Optional: `src/routes/wide-table/+page.svelte` — wide table demo (many columns)

## Notes
- PGLite initialized client-side only (onMount)
- Sample data should cover all column types: text, number, date, boolean, select-like
- Reference: svelte-table-kit `src/routes/+page.svelte` (258 LOC), `wide-table/+page.svelte` (336 LOC)
