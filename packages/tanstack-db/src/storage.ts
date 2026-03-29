import type { ColumnStateEntry } from "@shotleybuilder/svelte-gridlite-kit/adapter";
import type { ViewPreset } from "@shotleybuilder/svelte-gridlite-kit/types";

/**
 * StorageProvider — pluggable persistence for view/column state.
 *
 * TanStack DB has no SQL backend, so we abstract state persistence
 * behind this interface. Two built-in implementations:
 *   - InMemoryStorage (default, ephemeral)
 *   - LocalStorageProvider (persists to window.localStorage)
 */
export interface StorageProvider {
  loadColumnState(gridId: string, viewId?: string): Promise<ColumnStateEntry[]>;
  saveColumnState(
    gridId: string,
    columns: ColumnStateEntry[],
    viewId?: string,
  ): Promise<void>;
  saveView(gridId: string, view: ViewPreset): Promise<void>;
  loadView(viewId: string): Promise<ViewPreset | null>;
  loadViews(gridId: string): Promise<ViewPreset[]>;
  deleteView(viewId: string): Promise<void>;
  loadDefaultView(gridId: string): Promise<ViewPreset | null>;
  setDefaultView(gridId: string, viewId: string): Promise<void>;
}

// ─── InMemoryStorage ──────────────────────────────────────────────────────────

export class InMemoryStorage implements StorageProvider {
  private columnState = new Map<string, ColumnStateEntry[]>();
  private views = new Map<string, ViewPreset>();
  private viewsByGrid = new Map<string, Set<string>>();
  private defaults = new Map<string, string>();

  private colKey(gridId: string, viewId?: string): string {
    return viewId ? `${gridId}::${viewId}` : gridId;
  }

  async loadColumnState(
    gridId: string,
    viewId?: string,
  ): Promise<ColumnStateEntry[]> {
    return this.columnState.get(this.colKey(gridId, viewId)) ?? [];
  }

  async saveColumnState(
    gridId: string,
    columns: ColumnStateEntry[],
    viewId?: string,
  ): Promise<void> {
    this.columnState.set(this.colKey(gridId, viewId), columns);
  }

  async saveView(gridId: string, view: ViewPreset): Promise<void> {
    this.views.set(view.id, view);
    const set = this.viewsByGrid.get(gridId) ?? new Set();
    set.add(view.id);
    this.viewsByGrid.set(gridId, set);
  }

  async loadView(viewId: string): Promise<ViewPreset | null> {
    return this.views.get(viewId) ?? null;
  }

  async loadViews(gridId: string): Promise<ViewPreset[]> {
    const ids = this.viewsByGrid.get(gridId);
    if (!ids) return [];
    const views: ViewPreset[] = [];
    for (const id of ids) {
      const v = this.views.get(id);
      if (v) views.push(v);
    }
    return views.sort((a, b) => a.name.localeCompare(b.name));
  }

  async deleteView(viewId: string): Promise<void> {
    const view = this.views.get(viewId);
    this.views.delete(viewId);
    // Remove from grid index
    for (const [, set] of this.viewsByGrid) {
      set.delete(viewId);
    }
    // Remove associated column state
    if (view) {
      // Delete view-scoped column state for all grids
      for (const key of this.columnState.keys()) {
        if (key.endsWith(`::${viewId}`)) {
          this.columnState.delete(key);
        }
      }
    }
    this.columnState.delete(viewId);
    // Remove default if this was the default
    for (const [gridId, defaultId] of this.defaults) {
      if (defaultId === viewId) this.defaults.delete(gridId);
    }
  }

  async loadDefaultView(gridId: string): Promise<ViewPreset | null> {
    const viewId = this.defaults.get(gridId);
    if (!viewId) return null;
    return this.views.get(viewId) ?? null;
  }

  async setDefaultView(gridId: string, viewId: string): Promise<void> {
    this.defaults.set(gridId, viewId);
  }
}

// ─── LocalStorageProvider ─────────────────────────────────────────────────────

export class LocalStorageProvider implements StorageProvider {
  private prefix: string;

  constructor(prefix = "gridlite") {
    this.prefix = prefix;
  }

  private key(...parts: string[]): string {
    return [this.prefix, ...parts].join(":");
  }

  private getJSON<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private setJSON(key: string, value: unknown): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  async loadColumnState(
    gridId: string,
    viewId?: string,
  ): Promise<ColumnStateEntry[]> {
    const k = viewId
      ? this.key("colstate", gridId, viewId)
      : this.key("colstate", gridId);
    return this.getJSON<ColumnStateEntry[]>(k) ?? [];
  }

  async saveColumnState(
    gridId: string,
    columns: ColumnStateEntry[],
    viewId?: string,
  ): Promise<void> {
    const k = viewId
      ? this.key("colstate", gridId, viewId)
      : this.key("colstate", gridId);
    this.setJSON(k, columns);
  }

  async saveView(gridId: string, view: ViewPreset): Promise<void> {
    this.setJSON(this.key("view", view.id), view);
    // Track view IDs per grid
    const indexKey = this.key("viewindex", gridId);
    const ids: string[] = this.getJSON(indexKey) ?? [];
    if (!ids.includes(view.id)) {
      ids.push(view.id);
      this.setJSON(indexKey, ids);
    }
  }

  async loadView(viewId: string): Promise<ViewPreset | null> {
    return this.getJSON<ViewPreset>(this.key("view", viewId));
  }

  async loadViews(gridId: string): Promise<ViewPreset[]> {
    const ids: string[] = this.getJSON(this.key("viewindex", gridId)) ?? [];
    const views: ViewPreset[] = [];
    for (const id of ids) {
      const v = this.getJSON<ViewPreset>(this.key("view", id));
      if (v) views.push(v);
    }
    return views.sort((a, b) => a.name.localeCompare(b.name));
  }

  async deleteView(viewId: string): Promise<void> {
    localStorage.removeItem(this.key("view", viewId));
    // Remove from all grid indexes
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(this.key("viewindex"))) {
        const ids: string[] = this.getJSON(k) ?? [];
        const filtered = ids.filter((id) => id !== viewId);
        if (filtered.length !== ids.length) {
          this.setJSON(k, filtered);
        }
      }
    }
    // Remove associated column state keys
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(this.key("colstate")) && k.endsWith(viewId)) {
        localStorage.removeItem(k);
      }
    }
    // Remove default if this was the default
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(this.key("default"))) {
        const val = localStorage.getItem(k);
        if (val === viewId) localStorage.removeItem(k);
      }
    }
  }

  async loadDefaultView(gridId: string): Promise<ViewPreset | null> {
    const viewId = localStorage.getItem(this.key("default", gridId));
    if (!viewId) return null;
    return this.getJSON<ViewPreset>(this.key("view", viewId));
  }

  async setDefaultView(gridId: string, viewId: string): Promise<void> {
    localStorage.setItem(this.key("default", gridId), viewId);
  }
}
