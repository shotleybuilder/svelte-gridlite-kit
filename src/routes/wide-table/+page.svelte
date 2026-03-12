<script lang="ts">
	import { onMount } from 'svelte';
	import { PGlite } from '@electric-sql/pglite';
	import { live } from '@electric-sql/pglite/live';
	import type { PGliteWithLive } from '$lib/query/live.js';
	import GridLite from '$lib/GridLite.svelte';
	import '$lib/styles/gridlite.css';

	let db: PGliteWithLive | null = null;
	let ready = false;
	let initError: string | null = null;

	onMount(async () => {
		try {
		db = new PGlite({ extensions: { live } }) as PGliteWithLive;

		// 20-column table to test horizontal scroll and column management
		await db.exec(`
			CREATE TABLE products (
				id SERIAL PRIMARY KEY,
				sku TEXT NOT NULL,
				name TEXT NOT NULL,
				category TEXT NOT NULL,
				subcategory TEXT,
				brand TEXT,
				price NUMERIC(10, 2) NOT NULL,
				cost NUMERIC(10, 2),
				margin NUMERIC(5, 2),
				stock_qty INTEGER DEFAULT 0,
				reorder_level INTEGER DEFAULT 10,
				weight_kg NUMERIC(6, 2),
				width_cm NUMERIC(6, 2),
				height_cm NUMERIC(6, 2),
				color TEXT,
				material TEXT,
				supplier TEXT,
				created_at DATE,
				discontinued BOOLEAN DEFAULT false,
				notes TEXT
			)
		`);

		const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books'];
		const subcats = ['Accessories', 'Premium', 'Budget', 'Pro', 'Kids'];
		const brands = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark'];
		const colors = ['Red', 'Blue', 'Black', 'White', 'Green', 'Silver'];
		const materials = ['Plastic', 'Metal', 'Wood', 'Fabric', 'Glass'];
		const suppliers = ['SupplyCo', 'MegaDist', 'FastShip', 'BulkBuy', 'DirectSource'];

		const values: string[] = [];
		for (let i = 0; i < 50; i++) {
			const sku = `SKU-${String(1000 + i)}`;
			const name = `Product ${String.fromCharCode(65 + (i % 26))}${i}`;
			const cat = categories[i % categories.length];
			const subcat = subcats[i % subcats.length];
			const brand = brands[i % brands.length];
			const price = (10 + Math.random() * 490).toFixed(2);
			const cost = (5 + Math.random() * 200).toFixed(2);
			const margin = ((1 - parseFloat(cost) / parseFloat(price)) * 100).toFixed(2);
			const stock = Math.floor(Math.random() * 500);
			const reorder = 5 + Math.floor(Math.random() * 50);
			const weight = (0.1 + Math.random() * 20).toFixed(2);
			const width = (5 + Math.random() * 100).toFixed(2);
			const height = (2 + Math.random() * 80).toFixed(2);
			const color = colors[i % colors.length];
			const material = materials[i % materials.length];
			const supplier = suppliers[i % suppliers.length];
			const year = 2020 + Math.floor(Math.random() * 4);
			const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
			const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
			const discontinued = Math.random() < 0.1;

			values.push(
				`('${sku}', '${name}', '${cat}', '${subcat}', '${brand}', ${price}, ${cost}, ${margin}, ${stock}, ${reorder}, ${weight}, ${width}, ${height}, '${color}', '${material}', '${supplier}', '${year}-${month}-${day}', ${discontinued}, NULL)`
			);
		}

		await db.exec(`
			INSERT INTO products (sku, name, category, subcategory, brand, price, cost, margin, stock_qty, reorder_level, weight_kg, width_cm, height_cm, color, material, supplier, created_at, discontinued, notes)
			VALUES ${values.join(',\n')}
		`);

		ready = true;
		} catch (err) {
			initError = err instanceof Error ? err.message : String(err);
			console.error('PGLite initialization failed:', err);
		}
	});
</script>

<main>
	<h1>Wide Table Demo</h1>
	<p>20 columns, 50 rows. Tests horizontal scroll and column density.</p>

	{#if ready && db}
		<GridLite
			{db}
			table="products"
			config={{
				id: 'demo-products',
				pagination: { pageSize: 15 }
			}}
		/>
	{:else if initError}
		<p class="error">Error: {initError}</p>
	{:else}
		<p>Initializing PGLite...</p>
	{/if}
</main>

<style>
	main {
		max-width: 100%;
		margin: 0 auto;
		padding: 24px;
	}

	h1 {
		margin: 0 0 4px 0;
		font-size: 1.5rem;
	}

	p {
		margin: 0 0 16px 0;
		color: #666;
	}

	.error {
		color: #dc3545;
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		padding: 12px;
	}
</style>
