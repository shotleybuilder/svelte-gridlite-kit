<!--
  Custom Cell Rendering Example
  =============================
  Two approaches:
  1. format() functions — return plain strings (simple formatting)
  2. <slot name="cell"> — full HTML/component rendering (badges, links, buttons)
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { PGlite } from '@electric-sql/pglite';
	import { live } from '@electric-sql/pglite/live';
	import type { PGliteWithLive } from '$lib/query/live.js';
	import GridLite from '$lib/GridLite.svelte';
	import '$lib/styles/gridlite.css';

	let db: PGliteWithLive | null = null;
	let ready = false;

	onMount(async () => {
		db = new PGlite({ extensions: { live } }) as PGliteWithLive;

		await db.exec(`
			CREATE TABLE products (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				category TEXT NOT NULL,
				price NUMERIC(10,2) NOT NULL,
				stock INTEGER NOT NULL,
				rating NUMERIC(2,1),
				created_at DATE DEFAULT CURRENT_DATE,
				active BOOLEAN DEFAULT true
			)
		`);

		await db.exec(`
			INSERT INTO products (name, category, price, stock, rating, created_at, active) VALUES
			('Widget Pro', 'Electronics', 29.99, 150, 4.5, '2024-01-15', true),
			('Gadget X', 'Electronics', 149.99, 23, 3.8, '2024-03-22', true),
			('Super Bolt', 'Hardware', 2.50, 5000, 4.9, '2023-11-01', true),
			('Mega Nut', 'Hardware', 1.75, 8000, 4.2, '2023-06-15', true),
			('Soft Pillow', 'Home', 35.00, 0, 4.7, '2024-06-01', false),
			('Cozy Blanket', 'Home', 59.99, 42, 4.1, '2024-02-14', true),
			('Power Bank', 'Electronics', 45.00, 300, 3.5, '2024-08-10', true),
			('Desk Lamp', 'Home', 22.50, 88, NULL, '2024-09-01', true),
			('Cable Set', 'Electronics', 12.99, 1200, 4.0, '2023-12-25', true),
			('Wrench Kit', 'Hardware', 89.99, 15, 4.8, '2024-04-10', false)
		`);

		ready = true;
	});

	function handleEdit(row: Record<string, unknown>) {
		alert(`Edit: ${row.name} (ID ${row.id})`);
	}
</script>

<main>
	<h1>Custom Cell Rendering</h1>
	<p>Rich HTML cells via <code>&lt;slot name="cell"&gt;</code>: badges, colored tags, links, and action buttons.</p>

	{#if ready && db}
		<GridLite
			{db}
			table="products"
			config={{
				id: 'custom-cells',
				columns: [
					{ name: 'id', label: 'ID' },
					{ name: 'name', label: 'Product' },
					{ name: 'category', label: 'Category' },
					{ name: 'price', label: 'Price' },
					{ name: 'stock', label: 'Stock' },
					{ name: 'rating', label: 'Rating' },
					{ name: 'created_at', label: 'Added',
						format: (v) => v ? new Date(String(v)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
					{ name: 'active', label: 'Status' }
				],
				pagination: { pageSize: 25 }
			}}
			features={{
				filtering: true,
				sorting: true,
				pagination: true,
				columnVisibility: true
			}}
		>
			<!-- Rich cell rendering via slot -->
			<svelte:fragment slot="cell" let:value let:row let:column>
				{#if column === 'price'}
					<span class="price">${Number(value).toFixed(2)}</span>
				{:else if column === 'stock'}
					{@const n = Number(value)}
					<span class="stock-badge" class:out={n === 0} class:low={n > 0 && n < 20} class:ok={n >= 20}>
						{n === 0 ? 'Out of stock' : n < 20 ? `${n} Low` : n.toLocaleString()}
					</span>
				{:else if column === 'rating'}
					{#if value != null}
						<span class="rating">
							{#each Array(5) as _, i}
								<span class="star" class:filled={i < Math.round(Number(value))}>★</span>
							{/each}
							<span class="rating-num">{Number(value).toFixed(1)}</span>
						</span>
					{:else}
						<span class="no-rating">—</span>
					{/if}
				{:else if column === 'active'}
					<span class="status-badge" class:active={value === true} class:inactive={value !== true}>
						{value ? 'Active' : 'Discontinued'}
					</span>
				{:else if column === 'category'}
					<span class="category-tag category-{String(value).toLowerCase()}">{value}</span>
				{:else if column === 'name'}
					<strong>{value}</strong>
					<button class="edit-btn" on:click|stopPropagation={() => handleEdit(row)}>Edit</button>
				{:else}
					{value ?? ''}
				{/if}
			</svelte:fragment>

			<!-- Custom toolbar buttons -->
			<svelte:fragment slot="toolbar-end">
				<button class="toolbar-btn" on:click={() => alert('Export clicked')}>
					Export CSV
				</button>
			</svelte:fragment>
		</GridLite>
	{:else}
		<p>Loading...</p>
	{/if}
</main>

<style>
	main { max-width: 1100px; margin: 0 auto; padding: 24px; }
	h1 { margin: 0 0 4px; font-size: 1.5rem; }
	p { margin: 0 0 16px; color: #666; }
	code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }

	/* Price */
	.price { font-weight: 600; font-variant-numeric: tabular-nums; }

	/* Stock badges */
	.stock-badge {
		display: inline-block; padding: 2px 8px; border-radius: 12px;
		font-size: 0.8em; font-weight: 500;
	}
	.stock-badge.out { background: #fee2e2; color: #991b1b; }
	.stock-badge.low { background: #fef3c7; color: #92400e; }
	.stock-badge.ok { background: #d1fae5; color: #065f46; }

	/* Rating stars */
	.rating { white-space: nowrap; }
	.star { color: #d1d5db; }
	.star.filled { color: #f59e0b; }
	.rating-num { margin-left: 4px; font-size: 0.85em; color: #6b7280; }
	.no-rating { color: #9ca3af; }

	/* Status badges */
	.status-badge {
		display: inline-block; padding: 2px 8px; border-radius: 12px;
		font-size: 0.8em; font-weight: 500;
	}
	.status-badge.active { background: #d1fae5; color: #065f46; }
	.status-badge.inactive { background: #f3f4f6; color: #6b7280; }

	/* Category tags */
	.category-tag {
		display: inline-block; padding: 2px 8px; border-radius: 4px;
		font-size: 0.8em; font-weight: 500;
	}
	.category-electronics { background: #dbeafe; color: #1e40af; }
	.category-hardware { background: #fef3c7; color: #92400e; }
	.category-home { background: #ede9fe; color: #5b21b6; }

	/* Edit button */
	.edit-btn {
		margin-left: 8px; padding: 1px 8px; border: 1px solid #d1d5db;
		border-radius: 4px; background: white; font-size: 0.75em;
		cursor: pointer; color: #374151;
	}
	.edit-btn:hover { background: #f3f4f6; }

	/* Toolbar button */
	.toolbar-btn {
		padding: 4px 12px; border: 1px solid #d1d5db; border-radius: 4px;
		background: white; font-size: 0.85em; cursor: pointer; color: #374151;
	}
	.toolbar-btn:hover { background: #f3f4f6; }
</style>
