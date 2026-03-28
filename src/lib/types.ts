// TypeScript types for @shotleybuilder/svelte-gridlite-kit

import type { PGlite } from "@electric-sql/pglite";

// ─── GridLite Props ─────────────────────────────────────────────────────────

export interface GridLiteProps {
  /** PGLite database instance */
  db: PGlite;

  /** Table name to query (mutually exclusive with `query`) */
  table?: string;

  /** Raw SQL query (mutually exclusive with `table`) */
  query?: string;

  /** Grid configuration */
  config?: GridConfig;

  /** Feature flags */
  features?: GridFeatures;

  /** Styling */
  classNames?: Partial<ClassNameMap>;
  rowHeight?: RowHeight;
  columnSpacing?: ColumnSpacing;

  /** Callbacks */
  onRowClick?: (row: Record<string, unknown>) => void;
  onStateChange?: (state: GridState) => void;
}

// ─── Feature Flags ──────────────────────────────────────────────────────────

export interface GridFeatures {
  columnVisibility?: boolean;
  columnResizing?: boolean;
  columnReordering?: boolean;
  filtering?: boolean;
  sorting?: boolean;
  sortingMode?: "header" | "control";
  pagination?: boolean;
  grouping?: boolean;
  globalSearch?: boolean;
  rowDetail?: boolean;
  rowDetailMode?: "modal" | "drawer" | "inline";
}

// ─── Grid Configuration ─────────────────────────────────────────────────────

export interface GridConfig {
  /** Unique identifier for this grid instance (used for state persistence) */
  id: string;

  /** Column configuration overrides */
  columns?: ColumnConfig[];

  /** Default visible columns (by column name) */
  defaultVisibleColumns?: string[];

  /** Default column order (by column name) */
  defaultColumnOrder?: string[];

  /** Default column sizing */
  defaultColumnSizing?: Record<string, number>;

  /** Default filters applied on load */
  defaultFilters?: FilterNode[];

  /** Default filter logic */
  filterLogic?: FilterLogic;

  /** Default sorting applied on load */
  defaultSorting?: SortConfig[];

  /** Default grouping applied on load */
  defaultGrouping?: GroupConfig[];

  /** Pagination config */
  pagination?: {
    pageSize: number;
    pageSizeOptions?: number[];
  };

  /** Saved view presets */
  presets?: ViewPreset[];
}

// ─── Column Configuration ───────────────────────────────────────────────────

export interface ColumnConfig {
  /** Column name (must match database column) */
  name: string;

  /** Display label (defaults to column name) */
  label?: string;

  /** Data type override (auto-detected from schema if not set) */
  dataType?: ColumnDataType;

  /** Options for 'select' type columns */
  selectOptions?: { value: string; label: string }[];

  /** Custom cell formatter */
  format?: (value: unknown) => string;

  /** Whether column is visible by default */
  visible?: boolean;

  /** Column width in pixels */
  width?: number;

  /** Minimum column width */
  minWidth?: number;

  /** Maximum column width */
  maxWidth?: number;
}

/** Column data type — drives filter operator selection and value input rendering */
export type ColumnDataType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "json";

/** Schema-introspected column metadata (internal, from information_schema) */
export interface ColumnMetadata {
  name: string;
  dataType: ColumnDataType;
  postgresType: string;
  nullable: boolean;
  hasDefault: boolean;
}

// ─── Filtering ──────────────────────────────────────────────────────────────

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: unknown;
  /** Compare against another column instead of a literal value */
  valueColumn?: string;
  /** Interval offset added to valueColumn for date comparisons, e.g. "6 months" */
  intervalOffset?: string;
}

const VALID_INTERVAL = /^\d+\s+(second|minute|hour|day|week|month|year)s?$/i;

/** Validate an interval string against a safe pattern (prevents SQL injection) */
export function isValidInterval(s: string): boolean {
  return VALID_INTERVAL.test(s.trim());
}

export type FilterOperator =
  // String operators
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  // Numeric operators
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal"
  // Date operators
  | "is_before"
  | "is_after"
  // JSONB operators
  | "jsonb_has_key"
  | "jsonb_not_has_key";

export type FilterLogic = "and" | "or";

export interface FilterGroup {
  id: string;
  logic: FilterLogic;
  children: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return "children" in node && Array.isArray((node as FilterGroup).children);
}

// ─── Sorting ────────────────────────────────────────────────────────────────

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

// ─── Grouping ───────────────────────────────────────────────────────────────

export interface GroupConfig {
  column: string;
  aggregations?: AggregationConfig[];
}

export interface AggregationConfig {
  column: string;
  function: AggregateFunction;
  alias?: string;
}

export type AggregateFunction = "count" | "sum" | "avg" | "min" | "max";

// ─── View Presets ───────────────────────────────────────────────────────────

export interface ViewPreset {
  id: string;
  name: string;
  description?: string;
  filters?: FilterNode[];
  filterLogic?: FilterLogic;
  sorting?: SortConfig[];
  grouping?: GroupConfig[];
  columnVisibility?: Record<string, boolean>;
  columnOrder?: string[];
}

// ─── Grid State ─────────────────────────────────────────────────────────────

export interface GridState {
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  filters: FilterNode[];
  filterLogic: FilterLogic;
  sorting: SortConfig[];
  grouping: GroupConfig[];
  globalFilter: string;
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
}

// ─── Styling ────────────────────────────────────────────────────────────────

export type RowHeight = "short" | "medium" | "tall" | "extra_tall";
export type ColumnSpacing = "narrow" | "normal" | "wide";
export type ToolbarLayout = "airtable" | "excel" | "shadcn" | "aggrid";

export interface ClassNameMap {
  container: string;
  table: string;
  thead: string;
  tbody: string;
  tfoot: string;
  tr: string;
  th: string;
  td: string;
  pagination: string;
  filterBar: string;
  sortBar: string;
  groupBar: string;
}

// ─── Query Builder Output ───────────────────────────────────────────────────

/** Parameterized SQL query — never construct SQL by string concatenation */
export interface ParameterizedQuery {
  sql: string;
  params: unknown[];
}
