<!--
  Grouping Example
  ================
  Focused demo: hierarchical grouping with expand/collapse, aggregations,
  and multi-level nesting (up to 3 levels).
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

	const departments = ['Engineering', 'Marketing', 'Sales', 'Finance', 'HR', 'Operations'];
	const titles = ['Engineer', 'Senior Engineer', 'Manager', 'Analyst', 'Director', 'Coordinator'];

	onMount(async () => {
		db = new PGlite({ extensions: { live } }) as PGliteWithLive;

		await db.exec(`
			CREATE TABLE employees (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				department TEXT NOT NULL,
				title TEXT NOT NULL,
				salary NUMERIC(10,2) NOT NULL,
				location TEXT NOT NULL
			)
		`);

		const locations = ['London', 'New York', 'Berlin', 'Tokyo'];
		const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry',
			'Iris', 'Jack', 'Karen', 'Leo', 'Mia', 'Nathan', 'Olivia', 'Paul'];
		const values: string[] = [];
		for (let i = 0; i < 60; i++) {
			const name = names[i % names.length] + ' ' + (i + 1);
			const dept = departments[i % departments.length];
			const title = titles[i % titles.length];
			const salary = 50000 + Math.floor(Math.random() * 80000);
			const loc = locations[i % locations.length];
			values.push(`('${name}', '${dept}', '${title}', ${salary}, '${loc}')`);
		}
		await db.exec(`INSERT INTO employees (name, department, title, salary, location) VALUES ${values.join(',')}`);
		ready = true;
	});
</script>

<main>
	<h1>Grouping Example</h1>
	<p>Hierarchical grouping with aggregations. Try grouping by Department, then add Title as a sub-group. Click group headers to expand.</p>

	{#if ready && db}
		<GridLite
			{db}
			table="employees"
			config={{
				id: 'group-demo',
				columns: [
					{ name: 'id', label: 'ID' },
					{ name: 'name', label: 'Name' },
					{ name: 'department', label: 'Department' },
					{ name: 'title', label: 'Title' },
					{ name: 'salary', label: 'Salary', format: (v) => v ? `$${Number(v).toLocaleString()}` : '' },
					{ name: 'location', label: 'Location' }
				],
				defaultGrouping: [
					{
						column: 'department',
						aggregations: [
							{ column: 'salary', function: 'avg', alias: 'avg_salary' },
							{ column: 'salary', function: 'sum', alias: 'total_salary' }
						]
					}
				],
				pagination: { pageSize: 25 }
			}}
			features={{
				filtering: true,
				sorting: true,
				grouping: true,
				pagination: true,
				globalSearch: true
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
