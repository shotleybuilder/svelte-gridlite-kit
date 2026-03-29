<!--
  Minimal GridLite Example
  ========================
  Absolute minimum setup: PGLite + GridLite with zero config.
  Schema auto-detection, default everything — copy this and it works.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { PGlite } from '@electric-sql/pglite';
	import { live } from '@electric-sql/pglite/live';
	import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
	import '@shotleybuilder/svelte-gridlite-kit/styles';
	import { createPGLiteAdapter, type PGliteWithLive } from '@shotleybuilder/gridlite-adapter-pglite';
	import type { QueryAdapter } from '@shotleybuilder/svelte-gridlite-kit';

	let db: PGliteWithLive | null = null;
	let adapter: QueryAdapter | null = null;
	let ready = false;

	onMount(async () => {
		// 1. Create PGLite with the live extension (required for reactive queries)
		db = new PGlite({ extensions: { live } }) as PGliteWithLive;

		// 2. Create a table — GridLite will auto-detect columns from the schema
		await db.exec(`
			CREATE TABLE contacts (
				id SERIAL PRIMARY KEY,
				name TEXT NOT NULL,
				email TEXT,
				company TEXT,
				phone TEXT
			)
		`);

		// 3. Insert some data
		await db.exec(`
			INSERT INTO contacts (name, email, company, phone) VALUES
			('Alice Johnson', 'alice@acme.com', 'Acme Corp', '555-0101'),
			('Bob Smith', 'bob@globex.com', 'Globex Inc', '555-0102'),
			('Charlie Brown', 'charlie@initech.com', 'Initech', '555-0103'),
			('Diana Prince', 'diana@wayne.com', 'Wayne Enterprises', '555-0104'),
			('Eve Wilson', 'eve@stark.com', 'Stark Industries', '555-0105')
		`);

		// 4. Create adapter — wraps PGLite for GridLite
		adapter = createPGLiteAdapter({ db, table: 'contacts' });
		ready = true;
	});
</script>

<main>
	<h1>Minimal Example</h1>
	<p>Zero config — just a PGLite instance and a table name. Columns auto-detected from schema.</p>

	{#if ready && adapter}
		<!-- This is all you need: an adapter. Everything else is optional. -->
		<GridLite {adapter} config={{ id: 'minimal' }} />
	{:else}
		<p>Loading...</p>
	{/if}
</main>

<style>
	main { max-width: 900px; margin: 0 auto; padding: 24px; }
	h1 { margin: 0 0 4px; font-size: 1.5rem; }
	p { margin: 0 0 16px; color: #666; }
</style>
