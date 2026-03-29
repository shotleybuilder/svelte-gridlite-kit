import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStorage } from './storage.js';
import type { ViewPreset } from '@shotleybuilder/svelte-gridlite-kit/adapter';

describe('InMemoryStorage', () => {
	let storage: InMemoryStorage;

	beforeEach(() => {
		storage = new InMemoryStorage();
	});

	describe('column state', () => {
		it('saves and loads column state', async () => {
			const cols = [
				{ name: 'id', visible: true, width: 100, position: 0, label: null },
				{ name: 'name', visible: true, width: 200, position: 1, label: 'Full Name' },
			];
			await storage.saveColumnState('grid1', cols);
			const loaded = await storage.loadColumnState('grid1');
			expect(loaded).toEqual(cols);
		});

		it('returns empty array for unknown grid', async () => {
			const loaded = await storage.loadColumnState('unknown');
			expect(loaded).toEqual([]);
		});

		it('supports view-scoped state', async () => {
			const cols1 = [{ name: 'id', visible: true, width: 100, position: 0, label: null }];
			const cols2 = [{ name: 'id', visible: false, width: 150, position: 0, label: null }];
			await storage.saveColumnState('grid1', cols1);
			await storage.saveColumnState('grid1', cols2, 'view1');

			expect(await storage.loadColumnState('grid1')).toEqual(cols1);
			expect(await storage.loadColumnState('grid1', 'view1')).toEqual(cols2);
		});
	});

	describe('view persistence', () => {
		const makeView = (id: string, name: string): ViewPreset => ({
			id,
			name,
			filters: [],
			filterLogic: 'and',
			sorting: [],
			grouping: [],
			columnVisibility: {},
			columnOrder: [],
		});

		it('saves and loads a view', async () => {
			const view = makeView('v1', 'Default View');
			await storage.saveView('grid1', view);
			const loaded = await storage.loadView('v1');
			expect(loaded).toEqual(view);
		});

		it('loads all views for a grid sorted by name', async () => {
			await storage.saveView('grid1', makeView('v2', 'Zebra'));
			await storage.saveView('grid1', makeView('v1', 'Alpha'));
			await storage.saveView('grid2', makeView('v3', 'Other'));

			const views = await storage.loadViews('grid1');
			expect(views).toHaveLength(2);
			expect(views[0].name).toBe('Alpha');
			expect(views[1].name).toBe('Zebra');
		});

		it('deletes a view', async () => {
			await storage.saveView('grid1', makeView('v1', 'Test'));
			await storage.deleteView('v1');
			expect(await storage.loadView('v1')).toBeNull();
			expect(await storage.loadViews('grid1')).toHaveLength(0);
		});

		it('sets and loads default view', async () => {
			const view = makeView('v1', 'Default');
			await storage.saveView('grid1', view);
			await storage.setDefaultView('grid1', 'v1');
			const loaded = await storage.loadDefaultView('grid1');
			expect(loaded).toEqual(view);
		});

		it('returns null for nonexistent data', async () => {
			expect(await storage.loadView('nope')).toBeNull();
			expect(await storage.loadDefaultView('nope')).toBeNull();
			expect(await storage.loadViews('nope')).toEqual([]);
		});

		it('delete removes associated default', async () => {
			const view = makeView('v1', 'Default');
			await storage.saveView('grid1', view);
			await storage.setDefaultView('grid1', 'v1');
			await storage.deleteView('v1');
			expect(await storage.loadDefaultView('grid1')).toBeNull();
		});
	});
});
