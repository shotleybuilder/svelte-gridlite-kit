<!--
  Custom Cell Formatters Example
  ==============================
  Shows custom cell formatting: currency, dates, booleans, conditional values.
  Copy the format functions for your own columns.
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
</script>

<main>
	<h1>Custom Cell Formatters</h1>
	<p>Currency formatting, date formatting, boolean display, rating stars, and stock level indicators.</p>

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

					// Currency formatting
					{ name: 'price', label: 'Price',
						format: (v) => v != null ? `$${Number(v).toFixed(2)}` : '—' },

					// Stock level with indicator
					{ name: 'stock', label: 'Stock',
						format: (v) => {
							const n = Number(v);
							if (n === 0) return 'Out of stock';
							if (n < 20) return `${n} (Low)`;
							return n.toLocaleString();
						}
					},

					// Rating as stars
					{ name: 'rating', label: 'Rating',
						format: (v) => v != null ? `${'★'.repeat(Math.round(Number(v)))}${'☆'.repeat(5 - Math.round(Number(v)))} ${Number(v).toFixed(1)}` : 'No rating' },

					// Date formatting
					{ name: 'created_at', label: 'Added',
						format: (v) => v ? new Date(String(v)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },

					// Boolean as text
					{ name: 'active', label: 'Status',
						format: (v) => v ? 'Active' : 'Discontinued' }
				],
				pagination: { pageSize: 25 }
			}}
			features={{
				filtering: true,
				sorting: true,
				pagination: true,
				columnVisibility: true
			}}
		/>
	{:else}
		<p>Loading...</p>
	{/if}
</main>

<style>
	main { max-width: 1100px; margin: 0 auto; padding: 24px; }
	h1 { margin: 0 0 4px; font-size: 1.5rem; }
	p { margin: 0 0 16px; color: #666; }
</style>
