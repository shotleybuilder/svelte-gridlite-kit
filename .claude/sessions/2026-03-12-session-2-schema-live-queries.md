# Session 2: Schema Introspection & PGLite Live Query Wrapper

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 2

## Todo
- [x] Create `src/lib/query/schema.ts` — introspect table schema, map Postgres types to ColumnDataType
- [x] Create `src/lib/query/schema.test.ts` — test against in-memory PGLite
- [x] Create `src/lib/query/live.ts` — Svelte store wrapper for PGLite live queries
- [x] Create `src/lib/query/live.test.ts` — verify reactivity, cleanup on unsubscribe
- [x] Update `src/lib/index.ts` — export new modules

## Notes
- PGLite can be instantiated in-memory for tests (no IndexedDB needed)
- No direct svelte-table-kit equivalent — this is new code
- Live store `waitForState` helper needed `queueMicrotask` to defer unsubscribe (synchronous callback fires before `const unsub` is assigned)
- 74 tests passing across 3 test files
- Commit: `0c1b9cd`

**Ended**: 2026-03-12
