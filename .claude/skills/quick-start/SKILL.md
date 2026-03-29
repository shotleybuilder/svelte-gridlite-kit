---
name: gridlite-quick-start
description: "Minimal setup for svelte-gridlite-kit: install, adapter init (PGLite or TanStack DB), basic GridLite component, SvelteKit SSR/Vite config. Use when integrating GridLite into a new project."
user-invocable: true
---

# GridLite Quick Start

GridLite uses a pluggable adapter architecture. Choose **PGLite** (SQL in WASM) or **TanStack DB** (reactive in-memory collections).

---

## Option A: PGLite Adapter

### Install

```bash
pnpm add @shotleybuilder/svelte-gridlite-kit @shotleybuilder/gridlite-adapter-pglite @electric-sql/pglite
```

### SvelteKit Config

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

### Minimal Component

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { PGlite } from '@electric-sql/pglite';
  import { live } from '@electric-sql/pglite/live';
  import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
  import { createPGLiteAdapter } from '@shotleybuilder/gridlite-adapter-pglite';
  import '@shotleybuilder/svelte-gridlite-kit/styles';
  import type { QueryAdapter } from '@shotleybuilder/svelte-gridlite-kit/adapter';

  let adapter: QueryAdapter | null = null;

  onMount(async () => {
    const db = new PGlite({ extensions: { live } });

    await db.exec(`
      CREATE TABLE contacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        company TEXT
      )
    `);

    await db.exec(`
      INSERT INTO contacts (name, email, company) VALUES
      ('Alice', 'alice@example.com', 'Acme'),
      ('Bob', 'bob@example.com', 'Globex')
    `);

    adapter = createPGLiteAdapter({ db, table: 'contacts' });
  });
</script>

{#if adapter}
  <GridLite
    {adapter}
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

### What Happens Automatically (PGLite)

- Column names and types detected from `information_schema`
- Live query subscribes to table changes
- Pagination defaults to 25 rows/page
- Filter operators available based on detected column types
- View/column state persisted in PGLite config tables

### PGLite Persistence

```typescript
// Ephemeral (in-memory, lost on refresh)
const db = new PGlite({ extensions: { live } });

// Persistent (IndexedDB, survives refresh)
const db = new PGlite('idb://my-app', { extensions: { live } });
```

---

## Option B: TanStack DB Adapter

### Install

```bash
pnpm add @shotleybuilder/svelte-gridlite-kit @shotleybuilder/gridlite-adapter-tanstack-db @tanstack/db
```

### SvelteKit Config

```typescript
// src/routes/+layout.ts (or +page.ts)
export const ssr = false;
```

### Minimal Component

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { createCollection, localOnlyCollectionOptions } from '@tanstack/db';
  import { GridLite } from '@shotleybuilder/svelte-gridlite-kit';
  import { createTanStackDBAdapter } from '@shotleybuilder/gridlite-adapter-tanstack-db';
  import '@shotleybuilder/svelte-gridlite-kit/styles';
  import type { QueryAdapter } from '@shotleybuilder/svelte-gridlite-kit/adapter';

  let adapter: QueryAdapter | null = null;

  onMount(async () => {
    const collection = createCollection(
      localOnlyCollectionOptions({
        id: 'contacts',
        getKey: (item) => item.id,
        initialData: [
          { id: 1, name: 'Alice', email: 'alice@example.com', company: 'Acme' },
          { id: 2, name: 'Bob', email: 'bob@example.com', company: 'Globex' },
        ],
      }),
    );

    adapter = createTanStackDBAdapter({
      collection,
      columns: [
        { name: 'id', dataType: 'number', postgresType: 'unknown', nullable: false, hasDefault: false },
        { name: 'name', dataType: 'text', postgresType: 'unknown', nullable: false, hasDefault: false },
        { name: 'email', dataType: 'text', postgresType: 'unknown', nullable: true, hasDefault: false },
        { name: 'company', dataType: 'text', postgresType: 'unknown', nullable: true, hasDefault: false },
      ],
    });
  });
</script>

{#if adapter}
  <GridLite
    {adapter}
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

### Using Zod Schema (Alternative to Explicit Columns)

```typescript
import { z } from 'zod';

const contactSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().nullable(),
  company: z.string().nullable(),
});

adapter = createTanStackDBAdapter({
  collection,
  schema: contactSchema,
});
```

### What Happens Automatically (TanStack DB)

- Columns derived from explicit metadata or Zod schema
- Live query via `createLiveQueryCollection` reacts to collection changes
- Pagination defaults to 25 rows/page
- Filter operators translate to TanStack DB query builder expressions
- View/column state stored in-memory (or use `LocalStorageProvider` for persistence)

---

## Common Mistakes

1. **Forgetting `ssr = false`** — Both PGLite (WASM) and TanStack DB need browser APIs
2. **Missing `optimizeDeps.exclude`** — Only needed for PGLite (Vite tries to pre-bundle WASM)
3. **Not waiting for adapter** — GridLite needs the adapter instance fully created before rendering
4. **PGLite: forgetting the `live` extension** — Required for reactive queries
5. **TanStack DB: omitting both `columns` and `schema`** — Adapter needs column metadata from one or the other
