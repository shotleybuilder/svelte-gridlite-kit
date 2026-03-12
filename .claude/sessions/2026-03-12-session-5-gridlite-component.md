# Session 5: GridLite.svelte — Main Component (Minimal)

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 5

## Todo
- [ ] Create `src/lib/GridLite.svelte` — main component wiring query builder, live queries, schema introspection
- [ ] Update `src/lib/index.ts` — export GridLite component
- [ ] Update `src/routes/+page.svelte` — dev demo page with sample PGLite table

## Notes
- Convergence point: wires together sessions 1-4 (query builder, schema, live queries, state, utilities)
- Reference: svelte-table-kit `TableKit.svelte` (1,859 LOC) — much simpler since SQL replaces most logic
- Props: `db`, `table`, `query`, `config`, `features`, `classNames`, `rowHeight`, `columnSpacing`, `onRowClick`
