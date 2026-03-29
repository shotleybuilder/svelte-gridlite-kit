// Public API for @shotleybuilder/gridlite-adapter-pglite

export { createPGLiteAdapter, PGLiteAdapter } from "./adapter.js";
export type { PGLiteAdapterOptions, PGliteWithLive } from "./adapter.js";

// Re-export internals for advanced usage
export { createLiveQueryStore, createLiveQueryStoreFromQuery } from "./live.js";
export type { LiveQueryState, LiveQueryStore } from "./live.js";
export { introspectTable, getColumnNames } from "./schema.js";
export { runMigrations, getLatestVersion, isMigrated } from "./migrations.js";
export {
  saveView,
  loadView,
  loadViews,
  loadDefaultView,
  setDefaultView,
  deleteView,
  saveColumnState,
  loadColumnState,
} from "./views.js";
