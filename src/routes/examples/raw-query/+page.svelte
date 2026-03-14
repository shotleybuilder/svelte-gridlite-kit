<!--
  Raw SQL Query Example
  =====================
  Using the `query` prop instead of `table` for joins, CTEs, and custom SQL.
  All toolbar controls (filter, sort, group, pagination, search) work in query mode —
  the consumer's SQL is wrapped as a subquery and clauses are applied on top.
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
	let selectedQuery = 'join';

	const queries: Record<string, { label: string; sql: string; description: string }> = {
		join: {
			label: 'JOIN — Employees with Departments',
			description: 'Full toolbar: filter by department, sort by salary, paginate results.',
			sql: `
				SELECT e.id, e.name, e.salary, d.name AS department, d.budget
				FROM employees e
				JOIN departments d ON e.department_id = d.id
			`
		},
		aggregate: {
			label: 'Aggregate — Department Stats',
			description: 'Pre-aggregated query. Filter/sort still work on the result columns.',
			sql: `
				SELECT d.name AS department,
					COUNT(*) AS employee_count,
					ROUND(AVG(e.salary), 2) AS avg_salary,
					MIN(e.salary) AS min_salary,
					MAX(e.salary) AS max_salary,
					SUM(e.salary) AS total_payroll
				FROM employees e
				JOIN departments d ON e.department_id = d.id
				GROUP BY d.name
			`
		},
		cte: {
			label: 'CTE — Top Earners per Department',
			description: 'Window function query. Sort by rank, filter by department name.',
			sql: `
				WITH ranked AS (
					SELECT e.name, e.salary, d.name AS department,
						RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) AS rank
					FROM employees e
					JOIN departments d ON e.department_id = d.id
				)
				SELECT name, department, salary, rank
				FROM ranked WHERE rank <= 3
			`
		}
	};

	onMount(async () => {
		db = new PGlite({ extensions: { live } }) as PGliteWithLive;

		// Create two related tables
		await db.exec(`
			CREATE TABLE departments (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				budget NUMERIC(12,2) NOT NULL
			);
			INSERT INTO departments (name, budget) VALUES
			('Engineering', 2500000), ('Marketing', 800000),
			('Sales', 1200000), ('Finance', 600000), ('HR', 400000);

			CREATE TABLE employees (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				department_id INTEGER REFERENCES departments(id),
				salary NUMERIC(10,2) NOT NULL
			);
		`);

		// Seed 30 employees across departments
		const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace',
			'Henry', 'Iris', 'Jack', 'Karen', 'Leo', 'Mia', 'Nathan', 'Olivia',
			'Paul', 'Quinn', 'Rachel', 'Sam', 'Tina', 'Uma', 'Victor', 'Wendy',
			'Xavier', 'Yuki', 'Zara', 'Aaron', 'Bella', 'Carlos', 'Daphne'];
		const values = names.map((n, i) =>
			`('${n}', ${(i % 5) + 1}, ${55000 + Math.floor(Math.random() * 80000)})`
		);
		await db.exec(`INSERT INTO employees (name, department_id, salary) VALUES ${values.join(',')}`);

		ready = true;
	});
</script>

<main>
	<h1>Raw SQL Query Example</h1>
	<p>
		Using the <code>query</code> prop for JOINs, aggregates, and CTEs.
		All toolbar controls work — the query is wrapped as a subquery with filter/sort/pagination applied on top.
	</p>

	{#if ready && db}
		<!-- Query selector -->
		<div class="query-selector">
			{#each Object.entries(queries) as [key, q]}
				<button
					class:active={selectedQuery === key}
					on:click={() => selectedQuery = key}
				>{q.label}</button>
			{/each}
		</div>

		<p class="query-description">{queries[selectedQuery].description}</p>

		<!-- Show the SQL being executed -->
		<pre class="sql-preview">{queries[selectedQuery].sql.trim()}</pre>

		{#key selectedQuery}
			<GridLite
				{db}
				query={queries[selectedQuery].sql}
				config={{
					id: `raw-${selectedQuery}`,
					pagination: { pageSize: 10 }
				}}
				features={{
					filtering: true,
					sorting: true,
					grouping: true,
					pagination: true,
					globalSearch: true,
					columnVisibility: true,
					columnReordering: true,
					columnResizing: true,
					rowDetail: true
				}}
			/>
		{/key}
	{:else}
		<p>Loading...</p>
	{/if}
</main>

<style>
	main { max-width: 1100px; margin: 0 auto; padding: 24px; }
	h1 { margin: 0 0 4px; font-size: 1.5rem; }
	p { margin: 0 0 12px; color: #666; }
	code { background: #f1f3f5; padding: 2px 6px; border-radius: 3px; font-size: 0.875rem; }
	.query-selector { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
	.query-selector button { padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
	.query-selector button:hover { background: #f1f3f5; }
	.query-selector button.active { background: #edf2ff; border-color: #4c6ef5; color: #4c6ef5; font-weight: 600; }
	.query-description { font-style: italic; color: #495057; margin-bottom: 8px; }
	.sql-preview { background: #1a1a2e; color: #a5d8ff; padding: 16px; border-radius: 8px; font-size: 13px; overflow-x: auto; margin-bottom: 16px; line-height: 1.5; }
</style>
