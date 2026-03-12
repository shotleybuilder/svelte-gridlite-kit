# Session 2: Schema Introspection & PGLite Live Query Wrapper

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 2

## Todo
- [ ] Create `src/lib/query/schema.ts` — introspect table schema, map Postgres types to ColumnDataType
- [ ] Create `src/lib/query/schema.test.ts` — test against in-memory PGLite
- [ ] Create `src/lib/query/live.ts` — Svelte store wrapper for PGLite live queries
- [ ] Create `src/lib/query/live.test.ts` — verify reactivity, cleanup on unsubscribe
- [ ] Update `src/lib/index.ts` — export new modules

## Notes
- PGLite can be instantiated in-memory for tests (no IndexedDB needed)
- No direct svelte-table-kit equivalent — this is new code
