---
name: gridlite-quick-start
description: "Minimal setup for svelte-gridlite-kit: install, PGLite init, basic GridLite component, SvelteKit SSR/Vite config. Use when integrating GridLite into a new project."
user-invocable: true
---

# GridLite Quick Start

## Install

```bash
npm install @shotleybuilder/svelte-gridlite-kit @electric-sql/pglite
```

## SvelteKit Config

Disable SSR for pages using PGLite:

```typescript
// src/routes/+layout.ts (or +page.ts)
export const ssr = false;
```

Add to `vite.config.ts`:

```typescript
export default defineConfig({
  optimizeDeps: {
    exclude: ['@electric-sql/pglite']
  }
});
```

## Minimal Component

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { PGlite } from '@electric-sql/pglite';
  import { live } from '@electric-sql/pglite/live';
  import type { PGliteWithLive } from '@shotleybuilder/svelte-gridlite-kit';
  import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
  import '@shotleybuilder/svelte-gridlite-kit/styles';

  let db: PGliteWithLive | null = null;
  let ready = false;

  onMount(async () => {
    // 1. Create PGLite instance with live extension
    db = new PGlite({ extensions: { live } }) as PGliteWithLive;

    // 2. Create your table
    await db.exec(`
      CREATE TABLE contacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        company TEXT
      )
    `);

    // 3. Seed data (or load from API)
    await db.exec(`
      INSERT INTO contacts (name, email, company) VALUES
      ('Alice', 'alice@example.com', 'Acme'),
      ('Bob', 'bob@example.com', 'Globex')
    `);

    ready = true;
  });
</script>

{#if ready && db}
  <GridLite
    {db}
    table="contacts"
    config={{ id: 'my-grid' }}
    features={{
      filtering: true,
      sorting: true,
      pagination: true,
      globalSearch: true
    }}
  />
{/if}
```

## What Happens Automatically

- Column names and types detected from `information_schema`
- Live query subscribes to table changes
- Pagination defaults to 25 rows/page
- All filter operators available based on detected column types

## PGLite Persistence

```typescript
// Ephemeral (in-memory, lost on refresh)
const db = new PGlite({ extensions: { live } });

// Persistent (IndexedDB, survives refresh)
const db = new PGlite('idb://my-app', { extensions: { live } });
```

## Common Mistakes

1. **Forgetting `ssr = false`** — PGLite needs browser APIs (WASM, IndexedDB)
2. **Missing `optimizeDeps.exclude`** — Vite tries to pre-bundle PGLite and fails
3. **Not waiting for `ready`** — GridLite needs the PGLite instance fully initialized
4. **Forgetting the `live` extension** — GridLite requires `live.query()` for reactivity
