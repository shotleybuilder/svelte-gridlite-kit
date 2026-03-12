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
	ParameterizedQuery
} from './types.js';

// Query builder
export {
	quoteIdentifier,
	buildWhereClause,
	buildOrderByClause,
	buildGroupByClause,
	buildPaginationClause,
	buildQuery,
	buildCountQuery
} from './query/builder.js';
export type { QueryOptions } from './query/builder.js';
