/**
 * GridLite Config Table Migrations
 *
 * Creates and manages internal tables for persisting grid state:
 * - _gridlite_meta: migration version tracking
 * - _gridlite_views: saved view configurations per grid instance
 * - _gridlite_column_state: column visibility, ordering, sizing per view
 *
 * All tables are prefixed with `_gridlite_` to avoid collision with user tables.
 */

import type { PGlite } from "@electric-sql/pglite";

// ─── Migration Definitions ──────────────────────────────────────────────────

interface Migration {
  version: number;
  description: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Create meta, views, and column_state tables",
    sql: `
			CREATE TABLE IF NOT EXISTS _gridlite_meta (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS _gridlite_views (
				id TEXT PRIMARY KEY,
				grid_id TEXT NOT NULL,
				name TEXT NOT NULL,
				description TEXT,
				filters JSONB DEFAULT '[]',
				filter_logic TEXT DEFAULT 'and',
				sorting JSONB DEFAULT '[]',
				grouping JSONB DEFAULT '[]',
				column_visibility JSONB DEFAULT '{}',
				column_order JSONB DEFAULT '[]',
				is_default BOOLEAN DEFAULT false,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			);

			CREATE INDEX IF NOT EXISTS idx_gridlite_views_grid_id
				ON _gridlite_views (grid_id);

			CREATE TABLE IF NOT EXISTS _gridlite_column_state (
				grid_id TEXT NOT NULL,
				view_id TEXT NOT NULL DEFAULT '__default__',
				column_name TEXT NOT NULL,
				visible BOOLEAN DEFAULT true,
				width INTEGER,
				position INTEGER,
				PRIMARY KEY (grid_id, view_id, column_name)
			);

			CREATE INDEX IF NOT EXISTS idx_gridlite_column_state_grid
				ON _gridlite_column_state (grid_id);
		`,
  },
  {
    version: 2,
    description:
      "Add label column to column_state for user-editable column names",
    sql: `
			ALTER TABLE _gridlite_column_state ADD COLUMN IF NOT EXISTS label TEXT;
		`,
  },
];

// ─── Migration Runner ───────────────────────────────────────────────────────

/**
 * Get the current migration version from the database.
 * Returns 0 if the meta table doesn't exist yet.
 */
async function getCurrentVersion(db: PGlite): Promise<number> {
  try {
    const result = await db.query<{ value: string }>(
      `SELECT value FROM _gridlite_meta WHERE key = 'migration_version'`,
    );
    if (result.rows.length > 0) {
      return parseInt(result.rows[0].value, 10);
    }
    return 0;
  } catch {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Set the migration version in the meta table.
 */
async function setVersion(db: PGlite, version: number): Promise<void> {
  await db.query(
    `INSERT INTO _gridlite_meta (key, value) VALUES ('migration_version', $1)
		 ON CONFLICT (key) DO UPDATE SET value = $1`,
    [String(version)],
  );
}

/**
 * Run all pending migrations.
 *
 * This is idempotent — safe to call on every app startup.
 * Migrations use `IF NOT EXISTS` for table/index creation.
 *
 * @param db - PGLite instance
 * @returns The final migration version
 */
export async function runMigrations(db: PGlite): Promise<number> {
  const currentVersion = await getCurrentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    return currentVersion;
  }

  for (const migration of pending) {
    await db.exec(migration.sql);
    await setVersion(db, migration.version);
  }

  return pending[pending.length - 1].version;
}

/**
 * Get the latest migration version available.
 */
export function getLatestVersion(): number {
  return MIGRATIONS.length > 0 ? MIGRATIONS[MIGRATIONS.length - 1].version : 0;
}

/**
 * Check if migrations are up to date.
 */
export async function isMigrated(db: PGlite): Promise<boolean> {
  const current = await getCurrentVersion(db);
  return current >= getLatestVersion();
}
