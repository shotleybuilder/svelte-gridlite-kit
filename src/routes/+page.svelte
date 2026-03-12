<script lang="ts">
	import { onMount } from 'svelte';
	import { PGlite } from '@electric-sql/pglite';
	import { live } from '@electric-sql/pglite/live';
	import type { PGliteWithLive } from '$lib/query/live.js';
	import type { ToolbarLayout } from '$lib/types.js';
	import GridLite from '$lib/GridLite.svelte';
	import '$lib/styles/gridlite.css';

	let db: PGliteWithLive | null = null;
	let ready = false;
	let initError: string | null = null;
	let gridRef: GridLite;

	// Controls
	let pageSize = 10;
	let paginationEnabled = true;
	let filteringEnabled = true;
	let sortingEnabled = true;
	let groupingEnabled = true;
	let rowDetailEnabled = true;
	let globalSearchEnabled = true;
	let columnVisibilityEnabled = true;
	let columnResizingEnabled = true;
	let columnReorderingEnabled = true;
	let selectedLayout: ToolbarLayout = 'airtable';
	const layoutOptions: ToolbarLayout[] = ['airtable', 'excel', 'shadcn', 'aggrid'];
	const departments = ['Engineering', 'Marketing', 'Sales', 'Finance', 'HR', 'Operations', 'Legal', 'Support'];
	const statuses = ['Active', 'On Leave', 'Probation', 'Terminated'];

	onMount(async () => {
		try {
		db = new PGlite({ extensions: { live } }) as PGliteWithLive;

		await db.exec(`
			CREATE TABLE employees (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				email TEXT NOT NULL,
				department TEXT NOT NULL,
				title TEXT NOT NULL,
				salary NUMERIC(10, 2) NOT NULL,
				hire_date DATE NOT NULL,
				active BOOLEAN DEFAULT true,
				rating NUMERIC(2, 1),
				status TEXT DEFAULT 'Active'
			)
		`);

		// Seed 60 rows of realistic data
		const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack',
			'Karen', 'Leo', 'Mia', 'Nathan', 'Olivia', 'Paul', 'Quinn', 'Rachel', 'Sam', 'Tina',
			'Uma', 'Victor', 'Wendy', 'Xavier', 'Yuki', 'Zara', 'Aaron', 'Bella', 'Carlos', 'Daphne'];
		const lastNames = ['Johnson', 'Smith', 'Brown', 'Prince', 'Wilson', 'Miller', 'Lee', 'Ford', 'Chang', 'Ryan',
			'Davis', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young'];
		const titles = ['Engineer', 'Senior Engineer', 'Lead Engineer', 'Manager', 'Analyst', 'Coordinator',
			'Director', 'Specialist', 'Associate', 'VP'];

		const values: string[] = [];
		for (let i = 0; i < 60; i++) {
			const first = firstNames[i % firstNames.length];
			const last = lastNames[i % lastNames.length];
			const dept = departments[i % departments.length];
			const title = titles[i % titles.length];
			const salary = 55000 + Math.floor(Math.random() * 80000);
			const year = 2018 + Math.floor(Math.random() * 6);
			const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
			const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
			const active = Math.random() > 0.15;
			const rating = (3 + Math.random() * 2).toFixed(1);
			const status = statuses[Math.floor(Math.random() * statuses.length)];
			const email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;

			values.push(
				`('${first} ${last}', '${email}', '${dept}', '${title}', ${salary}, '${year}-${month}-${day}', ${active}, ${rating}, '${status}')`
			);
		}

		await db.exec(`
			INSERT INTO employees (name, email, department, title, salary, hire_date, active, rating, status)
			VALUES ${values.join(',\n')}
		`);

		ready = true;
		} catch (err) {
			initError = err instanceof Error ? err.message : String(err);
			console.error('PGLite initialization failed:', err);
		}
	});

	function handleRowClick(row: Record<string, unknown>) {
		console.log('Row clicked:', row);
	}
</script>

<main>
	<h1>Employees Demo</h1>
	<p>60 rows, 10 columns. Right-click cells for context menu. Click column headers for sort/filter/group. Click rows for detail modal.</p>

	<div class="controls">
		<label>
			<input type="checkbox" bind:checked={paginationEnabled} />
			Pagination
		</label>

		<label>
			<input type="checkbox" bind:checked={filteringEnabled} />
			Filtering
		</label>

		<label>
			<input type="checkbox" bind:checked={sortingEnabled} />
			Sorting
		</label>

		<label>
			<input type="checkbox" bind:checked={groupingEnabled} />
			Grouping
		</label>

		<label>
			<input type="checkbox" bind:checked={rowDetailEnabled} />
			Row Detail
		</label>

		<label>
			<input type="checkbox" bind:checked={globalSearchEnabled} />
			Global Search
		</label>

		<label>
			<input type="checkbox" bind:checked={columnVisibilityEnabled} />
			Column Visibility
		</label>

		<label>
			<input type="checkbox" bind:checked={columnResizingEnabled} />
			Column Resizing
		</label>

		<label>
			<input type="checkbox" bind:checked={columnReorderingEnabled} />
			Column Reordering
		</label>

		<label>
			Layout:
			<select bind:value={selectedLayout}>
				{#each layoutOptions as layout}
					<option value={layout}>{layout}</option>
				{/each}
			</select>
		</label>
	</div>

	{#if ready && db}
		<GridLite
			bind:this={gridRef}
			{db}
			table="employees"
			toolbarLayout={selectedLayout}
			onRowClick={handleRowClick}
			config={{
				id: 'demo-employees',
				pagination: { pageSize },
				columns: [
					{ name: 'id', label: 'ID' },
					{ name: 'name', label: 'Name' },
					{ name: 'email', label: 'Email' },
					{ name: 'department', label: 'Department' },
					{ name: 'title', label: 'Title' },
					{ name: 'salary', label: 'Salary' },
					{ name: 'hire_date', label: 'Hire Date' },
					{ name: 'active', label: 'Active' },
					{ name: 'rating', label: 'Rating' },
					{ name: 'status', label: 'Status' }
				]
			}}
			features={{
				pagination: paginationEnabled,
				filtering: filteringEnabled,
				sorting: sortingEnabled,
				grouping: groupingEnabled,
				rowDetail: rowDetailEnabled,
				globalSearch: globalSearchEnabled,
				columnVisibility: columnVisibilityEnabled,
				columnResizing: columnResizingEnabled,
				columnReordering: columnReorderingEnabled
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
		max-width: 1200px;
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

	.controls {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 0;
		margin-bottom: 8px;
		flex-wrap: wrap;
	}

	label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: #495057;
	}

	.error {
		color: #dc3545;
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		padding: 12px;
	}
</style>
