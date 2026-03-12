# Session 3: State Persistence (Views & Migrations)

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 3

## Todo
- [ ] Create `src/lib/state/migrations.ts` — config table schemas, version-tracked migration runner
- [ ] Create `src/lib/state/migrations.test.ts` — table creation, migration idempotency
- [ ] Create `src/lib/state/views.ts` — CRUD for view configs (column visibility, ordering, sizing, filter/sort presets)
- [ ] Create `src/lib/state/views.test.ts` — round-trip save/load, multiple views per table
- [ ] Update `src/lib/index.ts` — export new modules

## Notes
- Config tables prefixed `_gridlite_` to avoid collision with user tables
- Migration version stored in `_gridlite_meta` table
- Views identified by grid instance ID (from `config.id`)
- Reference: svelte-table-kit `stores/persistence.ts` (conceptually — completely different implementation)
