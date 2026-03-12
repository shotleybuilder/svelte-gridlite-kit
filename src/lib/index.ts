// Public API for @shotleybuilder/svelte-gridlite-kit

// TypeScript types
export type {
  GridLiteProps,
  GridConfig,
  GridFeatures,
  GridState,
  ColumnConfig,
  ColumnDataType,
  ColumnMetadata,
  FilterCondition,
  FilterOperator,
  FilterLogic,
  SortConfig,
  GroupConfig,
  AggregationConfig,
  AggregateFunction,
  ViewPreset,
  ClassNameMap,
  RowHeight,
  ColumnSpacing,
  ParameterizedQuery,
} from "./types.js";

// Query builder
export {
  quoteIdentifier,
  buildWhereClause,
  buildOrderByClause,
  buildGroupByClause,
  buildPaginationClause,
  buildQuery,
  buildCountQuery,
} from "./query/builder.js";
export type { QueryOptions } from "./query/builder.js";

// Schema introspection
export {
  mapPostgresType,
  introspectTable,
  getColumnNames,
} from "./query/schema.js";

// Live query store
export {
  createLiveQueryStore,
  createLiveQueryStoreFromQuery,
} from "./query/live.js";
export type {
  LiveQueryState,
  LiveQueryStore,
  PGliteWithLive,
} from "./query/live.js";

// State persistence — migrations
export {
  runMigrations,
  getLatestVersion,
  isMigrated,
} from "./state/migrations.js";

// State persistence — views
export {
  saveView,
  loadView,
  loadViews,
  loadDefaultView,
  setDefaultView,
  deleteView,
  saveColumnState,
  loadColumnState,
} from "./state/views.js";
