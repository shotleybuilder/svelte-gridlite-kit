// Public API for @shotleybuilder/svelte-gridlite-kit

// Main component
export { default as GridLite } from "./GridLite.svelte";

// UI components
export { default as FilterBar } from "./components/FilterBar.svelte";
export { default as FilterConditionRow } from "./components/FilterCondition.svelte";
export { default as SortBar } from "./components/SortBar.svelte";
export { default as SortCondition } from "./components/SortCondition.svelte";
export { default as GroupBar } from "./components/GroupBar.svelte";
export { default as CellContextMenu } from "./components/CellContextMenu.svelte";
export { default as ColumnMenu } from "./components/ColumnMenu.svelte";
export { default as ColumnPicker } from "./components/ColumnPicker.svelte";
export { default as RowDetailModal } from "./components/RowDetailModal.svelte";

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
  buildGlobalSearchClause,
  buildGroupSummaryQuery,
  buildGroupCountQuery,
  buildGroupDetailQuery,
  buildQuery,
  buildCountQuery,
} from "./query/builder.js";
export type {
  QueryOptions,
  GroupSummaryOptions,
  GroupDetailOptions,
} from "./query/builder.js";

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

// Filter utilities
export { getOperatorsForType } from "./utils/filters.js";
export type { OperatorOption } from "./utils/filters.js";

// Fuzzy search utilities
export { fuzzyMatch, fuzzySearch, highlightMatches } from "./utils/fuzzy.js";
export type { FuzzyMatch } from "./utils/fuzzy.js";

// Formatters
export {
  formatDate,
  formatCurrency,
  formatNumber,
  formatPercent,
} from "./utils/formatters.js";
