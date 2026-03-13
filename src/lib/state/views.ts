/**
 * View Configuration Persistence
 *
 * CRUD operations for grid view configs stored in PGLite tables.
 * Each grid instance (identified by `gridId`) can have multiple named views.
 * One view per grid can be marked as the default.
 *
 * Requires `runMigrations()` to have been called first.
 */

import type { PGlite } from "@electric-sql/pglite";
import type {
  FilterCondition,
  FilterLogic,
  SortConfig,
  GroupConfig,
  ViewPreset,
} from "../types.js";

// ─── Database Row Types ─────────────────────────────────────────────────────

interface ViewRow {
  id: string;
  grid_id: string;
  name: string;
  description: string | null;
  filters: FilterCondition[];
  filter_logic: string;
  sorting: SortConfig[];
  grouping: GroupConfig[];
  column_visibility: Record<string, boolean>;
  column_order: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface ColumnStateRow {
  grid_id: string;
  view_id: string;
  column_name: string;
  visible: boolean;
  width: number | null;
  position: number | null;
  label: string | null;
}

// ─── View CRUD ──────────────────────────────────────────────────────────────

/**
 * Save a view configuration. Creates or updates (upserts).
 */
export async function saveView(
  db: PGlite,
  gridId: string,
  view: ViewPreset,
): Promise<void> {
  await db.query(
    `INSERT INTO _gridlite_views
			(id, grid_id, name, description, filters, filter_logic, sorting, grouping, column_visibility, column_order, is_default, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, CURRENT_TIMESTAMP)
		 ON CONFLICT (id) DO UPDATE SET
			name = $3,
			description = $4,
			filters = $5,
			filter_logic = $6,
			sorting = $7,
			grouping = $8,
			column_visibility = $9,
			column_order = $10,
			updated_at = CURRENT_TIMESTAMP`,
    [
      view.id,
      gridId,
      view.name,
      view.description ?? null,
      JSON.stringify(view.filters ?? []),
      view.filterLogic ?? "and",
      JSON.stringify(view.sorting ?? []),
      JSON.stringify(view.grouping ?? []),
      JSON.stringify(view.columnVisibility ?? {}),
      JSON.stringify(view.columnOrder ?? []),
    ],
  );
}

/**
 * Load a single view by ID.
 */
export async function loadView(
  db: PGlite,
  viewId: string,
): Promise<ViewPreset | null> {
  const result = await db.query<ViewRow>(
    `SELECT * FROM _gridlite_views WHERE id = $1`,
    [viewId],
  );

  if (result.rows.length === 0) return null;
  return rowToViewPreset(result.rows[0]);
}

/**
 * Load all views for a grid instance.
 */
export async function loadViews(
  db: PGlite,
  gridId: string,
): Promise<ViewPreset[]> {
  const result = await db.query<ViewRow>(
    `SELECT * FROM _gridlite_views WHERE grid_id = $1 ORDER BY name`,
    [gridId],
  );

  return result.rows.map(rowToViewPreset);
}

/**
 * Load the default view for a grid instance (if one is set).
 */
export async function loadDefaultView(
  db: PGlite,
  gridId: string,
): Promise<ViewPreset | null> {
  const result = await db.query<ViewRow>(
    `SELECT * FROM _gridlite_views WHERE grid_id = $1 AND is_default = true LIMIT 1`,
    [gridId],
  );

  if (result.rows.length === 0) return null;
  return rowToViewPreset(result.rows[0]);
}

/**
 * Set a view as the default for its grid. Clears any existing default first.
 */
export async function setDefaultView(
  db: PGlite,
  gridId: string,
  viewId: string,
): Promise<void> {
  // Clear existing default
  await db.query(
    `UPDATE _gridlite_views SET is_default = false WHERE grid_id = $1`,
    [gridId],
  );
  // Set new default
  await db.query(
    `UPDATE _gridlite_views SET is_default = true WHERE id = $1 AND grid_id = $2`,
    [viewId, gridId],
  );
}

/**
 * Delete a view by ID.
 */
export async function deleteView(db: PGlite, viewId: string): Promise<void> {
  // Also clean up associated column state
  await db.query(`DELETE FROM _gridlite_column_state WHERE view_id = $1`, [
    viewId,
  ]);
  await db.query(`DELETE FROM _gridlite_views WHERE id = $1`, [viewId]);
}

// ─── Column State CRUD ──────────────────────────────────────────────────────

/**
 * Save column state for a grid (optionally scoped to a view).
 * Replaces all existing column state for the given grid+view.
 */
export async function saveColumnState(
  db: PGlite,
  gridId: string,
  columns: {
    name: string;
    visible?: boolean;
    width?: number;
    position?: number;
    label?: string | null;
  }[],
  viewId: string = "__default__",
): Promise<void> {
  // Clear existing state for this grid+view
  await db.query(
    `DELETE FROM _gridlite_column_state WHERE grid_id = $1 AND view_id = $2`,
    [gridId, viewId],
  );

  // Insert new state
  for (const col of columns) {
    await db.query(
      `INSERT INTO _gridlite_column_state (grid_id, view_id, column_name, visible, width, position, label)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        gridId,
        viewId,
        col.name,
        col.visible ?? true,
        col.width ?? null,
        col.position ?? null,
        col.label ?? null,
      ],
    );
  }
}

/**
 * Load column state for a grid (optionally scoped to a view).
 */
export async function loadColumnState(
  db: PGlite,
  gridId: string,
  viewId: string = "__default__",
): Promise<
  {
    name: string;
    visible: boolean;
    width: number | null;
    position: number | null;
    label: string | null;
  }[]
> {
  const result = await db.query<ColumnStateRow>(
    `SELECT * FROM _gridlite_column_state
		 WHERE grid_id = $1 AND view_id = $2
		 ORDER BY position NULLS LAST, column_name`,
    [gridId, viewId],
  );

  return result.rows.map((row) => ({
    name: row.column_name,
    visible: row.visible,
    width: row.width,
    position: row.position,
    label: row.label,
  }));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function rowToViewPreset(row: ViewRow): ViewPreset {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    filters: row.filters as FilterCondition[],
    filterLogic: row.filter_logic as FilterLogic,
    sorting: row.sorting as SortConfig[],
    grouping: row.grouping as GroupConfig[],
    columnVisibility: row.column_visibility as Record<string, boolean>,
    columnOrder: row.column_order as string[],
  };
}
