<!--
  Filtering Example
  =================
  Focused demo: FilterBar with pre-set filters and programmatic filter control.
  Shows AND/OR logic, default filters, and context menu filtering.
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
	let grid: GridLite;

	const departments = ['Engineering', 'Marketing', 'Sales', 'Finance', 'HR'];

	onMount(async () => {
		db = new PGlite({ extensions: { live } }) as PGliteWithLive;

		await db.exec(`
			CREATE TABLE employees (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				department TEXT NOT NULL,
				salary NUMERIC(10,2) NOT NULL,
				active BOOLEAN DEFAULT true
			)
		`);

		const values: string[] = [];
		const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack',
			'Karen', 'Leo', 'Mia', 'Nathan', 'Olivia', 'Paul', 'Quinn', 'Rachel', 'Sam', 'Tina'];
		for (let i = 0; i < 40; i++) {
			const name = names[i % names.length] + ' ' + (i + 1);
			const dept = departments[i % departments.length];
			const salary = 50000 + Math.floor(Math.random() * 80000);
			const active = Math.random() > 0.2;
			values.push(`('${name}', '${dept}', ${salary}, ${active})`);
		}
		await db.exec(`INSERT INTO employees (name, department, salary, active) VALUES ${values.join(',')}`);
		ready = true;
	});

	// Programmatic filter controls
	function filterDepartment(dept: string) {
		grid.setFilters([{ id: 'dept', field: 'department', operator: 'equals', value: dept }], 'and');
	}

	function filterHighSalary() {
		grid.setFilters([{ id: 'sal', field: 'salary', operator: 'greater_than', value: 80000 }], 'and');
	}

	function filterCombined() {
		grid.setFilters([
			{ id: 'dept', field: 'department', operator: 'equals', value: 'Engineering' },
			{ id: 'sal', field: 'salary', operator: 'greater_than', value: 60000 }
		], 'and');
	}

	function clearFilters() {
		grid.setFilters([]);
	}
</script>

<main>
	<h1>Filtering Example</h1>
	<p>FilterBar with 14+ operators. Right-click cells for context menu filters. Use buttons below for programmatic control.</p>

	{#if ready && db}
		<!-- Programmatic filter buttons -->
		<div class="buttons">
			{#each departments as dept}
				<button on:click={() => filterDepartment(dept)}>{dept}</button>
			{/each}
			<button on:click={filterHighSalary}>Salary &gt; $80k</button>
			<button on:click={filterCombined}>Engineering + &gt;$60k</button>
			<button class="clear" on:click={clearFilters}>Clear All</button>
		</div>

		<GridLite
			bind:this={grid}
			{db}
			table="employees"
			config={{
				id: 'filter-demo',
				columns: [
					{ name: 'id', label: 'ID' },
					{ name: 'name', label: 'Name' },
					{ name: 'department', label: 'Department' },
					{ name: 'salary', label: 'Salary', format: (v) => v ? `$${Number(v).toLocaleString()}` : '' },
					{ name: 'active', label: 'Active', format: (v) => v ? 'Yes' : 'No' }
				],
				pagination: { pageSize: 20 }
			}}
			features={{
				filtering: true,
				sorting: true,
				pagination: true,
				globalSearch: true
			}}
		/>
	{:else}
		<p>Loading...</p>
	{/if}
</main>

<style>
	main { max-width: 1000px; margin: 0 auto; padding: 24px; }
	h1 { margin: 0 0 4px; font-size: 1.5rem; }
	p { margin: 0 0 12px; color: #666; }
	.buttons { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
	.buttons button { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; }
	.buttons button:hover { background: #f1f3f5; }
	.buttons .clear { color: #dc3545; border-color: #dc3545; }
</style>
