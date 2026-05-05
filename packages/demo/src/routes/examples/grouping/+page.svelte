<!--
  Grouping Example
  ================
  Focused demo: hierarchical grouping with expand/collapse, aggregations,
  multi-level nesting, and live reactivity (mutations update groups in real time).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { PGlite } from '@electric-sql/pglite';
	import { live } from '@electric-sql/pglite/live';
	import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
	import type { QueryAdapter } from '@shotleybuilder/svelte-gridlite-kit';
	import '@shotleybuilder/svelte-gridlite-kit/styles';
	import { createPGLiteAdapter, type PGliteWithLive } from '@shotleybuilder/gridlite-adapter-pglite';

	let db: PGliteWithLive | null = null;
	let adapter: QueryAdapter | null = null;
	let ready = false;
	let mutationLog: string[] = [];

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
		adapter = createPGLiteAdapter({ db, table: 'employees' });
		ready = true;
	});

	function logMutation(msg: string) {
		mutationLog = [msg, ...mutationLog].slice(0, 5);
	}

	async function addEmployee() {
		if (!db) return;
		const dept = departments[Math.floor(Math.random() * departments.length)];
		const title = titles[Math.floor(Math.random() * titles.length)];
		const salary = 55000 + Math.floor(Math.random() * 70000);
		const name = 'New Hire ' + Date.now().toString(36).slice(-4).toUpperCase();
		await db.exec(
			`INSERT INTO employees (name, department, title, salary, location) VALUES ('${name}', '${dept}', '${title}', ${salary}, 'London')`
		);
		logMutation(`Added ${name} to ${dept} ($${salary.toLocaleString()})`);
	}

	async function giveRaises() {
		if (!db) return;
		const dept = departments[Math.floor(Math.random() * departments.length)];
		const pct = 5 + Math.floor(Math.random() * 16); // 5-20%
		await db.exec(
			`UPDATE employees SET salary = salary * ${1 + pct / 100} WHERE department = '${dept}'`
		);
		logMutation(`${pct}% raise for all ${dept} employees`);
	}

	async function moveDepartment() {
		if (!db) return;
		const from = departments[Math.floor(Math.random() * departments.length)];
		let to = departments[Math.floor(Math.random() * departments.length)];
		while (to === from) to = departments[Math.floor(Math.random() * departments.length)];
		await db.exec(
			`UPDATE employees SET department = '${to}' WHERE id = (SELECT id FROM employees WHERE department = '${from}' LIMIT 1)`
		);
		logMutation(`Moved 1 employee from ${from} to ${to}`);
	}

	async function removeEmployee() {
		if (!db) return;
		const result = await db.query<{ id: number; name: string; department: string }>(
			`SELECT id, name, department FROM employees ORDER BY id DESC LIMIT 1`
		);
		if (result.rows.length > 0) {
			const emp = result.rows[0];
			await db.exec(`DELETE FROM employees WHERE id = ${emp.id}`);
			logMutation(`Removed ${emp.name} from ${emp.department}`);
		}
	}
</script>

<main>
	<h1>Grouping Example</h1>
	<p>Hierarchical grouping with live reactivity. Expand a group, then mutate data — counts, aggregations, and detail rows update automatically.</p>

	<div class="mutation-controls">
		<span class="label">Mutate data:</span>
		<button on:click={addEmployee}>Add Employee</button>
		<button on:click={giveRaises}>Give Raises</button>
		<button on:click={moveDepartment}>Move Department</button>
		<button on:click={removeEmployee}>Remove Employee</button>
	</div>

	{#if mutationLog.length > 0}
		<div class="mutation-log">
			{#each mutationLog as entry}
				<div class="log-entry">{entry}</div>
			{/each}
		</div>
	{/if}

	{#if ready && adapter}
		<GridLite
			{adapter}
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

	.mutation-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}
	.mutation-controls .label {
		font-size: 0.85rem;
		color: #888;
		font-weight: 500;
	}
	.mutation-controls button {
		padding: 6px 12px;
		border: 1px solid #ddd;
		border-radius: 6px;
		background: #fff;
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.15s;
	}
	.mutation-controls button:hover {
		background: #f0f4ff;
		border-color: #99b;
	}

	.mutation-log {
		margin-bottom: 12px;
		padding: 8px 12px;
		background: #f8f9fa;
		border-radius: 6px;
		border: 1px solid #e9ecef;
		font-size: 0.8rem;
	}
	.log-entry {
		color: #495057;
		padding: 2px 0;
	}
	.log-entry:first-child {
		font-weight: 500;
		color: #228be6;
	}
</style>
