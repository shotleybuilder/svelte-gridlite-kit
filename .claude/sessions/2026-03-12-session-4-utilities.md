# Session 4: Utilities (Fuzzy Search & Formatters)

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 4

## Todo
- [x] Create `src/lib/utils/fuzzy.ts` — fuzzy search with scoring (port from svelte-table-kit)
- [x] Create `src/lib/utils/fuzzy.test.ts` — port existing tests (29 tests)
- [x] Create `src/lib/utils/formatters.ts` — date, currency, number formatters (port)
- [x] Create `src/lib/utils/filters.ts` — getOperatorsForType() maps ColumnDataType to operators
- [x] Create `src/lib/styles/gridlite.css` — base styles (row height, spacing, toolbar, pagination)
- [x] Update `src/lib/index.ts` — export new modules

## Notes
- Direct ports from svelte-table-kit with minimal adaptation
- Also ported filters.ts (operator-per-type mapping) — needed by FilterBar in session 6
- 125 tests passing across 6 test files
- Commit: `9a018b2`

**Ended**: 2026-03-12
