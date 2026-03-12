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
			CREATE TABLE employees (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				department TEXT NOT NULL,
				salary NUMERIC(10, 2) NOT NULL,
				hire_date DATE NOT NULL,
				active BOOLEAN DEFAULT true
			)
		`);

		await db.exec(`
			INSERT INTO employees (name, department, salary, hire_date, active) VALUES
				('Alice Johnson', 'Engineering', 95000, '2021-03-15', true),
				('Bob Smith', 'Marketing', 72000, '2020-07-01', true),
				('Charlie Brown', 'Engineering', 105000, '2019-11-20', true),
				('Diana Prince', 'Sales', 68000, '2022-01-10', true),
				('Eve Wilson', 'Engineering', 112000, '2018-05-22', true),
				('Frank Miller', 'Marketing', 78000, '2021-09-30', false),
				('Grace Lee', 'Sales', 71000, '2023-02-14', true),
				('Henry Ford', 'Engineering', 98000, '2020-04-01', true),
				('Iris Chang', 'Marketing', 82000, '2019-08-15', true),
				('Jack Ryan', 'Sales', 65000, '2023-06-01', true)
		`);

		ready = true;
	});
</script>

<main>
	<h1>svelte-gridlite-kit</h1>
	<p>Dev demo — Session 5a will expand this with feature flag controls.</p>

	{#if ready && db}
		<GridLite
			{db}
			table="employees"
			config={{
				id: 'demo-employees',
				pagination: { pageSize: 5 }
			}}
		/>
	{:else}
		<p>Initializing PGLite...</p>
	{/if}
</main>

<style>
	main {
		max-width: 960px;
		margin: 0 auto;
		padding: 24px;
	}
</style>
