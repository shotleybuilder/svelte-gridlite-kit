# Session 8: Context Menus, Column Menu & Row Detail

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 8

## Todo
- [x] Create `src/lib/components/CellContextMenu.svelte` — right-click actions
- [x] Create `src/lib/components/ColumnMenu.svelte` — column header dropdown
- [x] Create `src/lib/components/RowDetailModal.svelte` — row detail overlay
- [x] Wire all three into GridLite.svelte
- [x] Update demo page to exercise new components
- [x] Update `src/lib/index.ts` — export new components
- [x] Run type checking and tests

## Notes
- Reference: svelte-table-kit CellContextMenu (233 LOC), ColumnMenu (291 LOC), RowDetailModal (214 LOC)
- CellContextMenu: callback-based (not event dispatch), uses ColumnMetadata not TanStack Column
- ColumnMenu: callback-based, replaces TanStack column.getIsSorted() with SortConfig[] lookup
- RowDetailModal: keep slot-based content, replace isBrowser with onMount pattern

**Ended**: 2026-03-12
