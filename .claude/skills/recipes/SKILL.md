---
name: gridlite-recipes
description: "GridLite common integration patterns: custom cell formatters, rich cell rendering via slots, toolbar slots, row detail modal, raw query mode, programmatic refresh. Use for copy-paste examples."
user-invocable: true
---

# GridLite Recipes

## Custom Cell Formatters (Plain Text)

Use `format()` for simple text-only formatting:

```svelte
<GridLite
  config={{
    id: 'grid',
    columns: [
      { name: 'salary', label: 'Salary',
        format: (v) => v ? `$${Number(v).toLocaleString()}` : '—' },
      { name: 'hire_date', label: 'Hired',
        format: (v) => v ? new Date(String(v)).toLocaleDateString() : '—' },
      { name: 'active', label: 'Status',
        format: (v) => v ? 'Active' : 'Inactive' },
      { name: 'rating', label: 'Rating',
        format: (v) => v ? `${Number(v).toFixed(1)} / 5.0` : 'N/A' }
    ]
  }}
/>
```

## Rich Cell Rendering (HTML via Slot)

Use `<slot name="cell">` for badges, links, buttons, or any HTML:

```svelte
<GridLite {db} table="employees" config={{ id: 'grid' }}>
  <svelte:fragment slot="cell" let:value let:row let:column>
    {#if column === 'status'}
      <span class="badge" class:active={value === 'active'}>
        {value}
      </span>
    {:else if column === 'salary'}
      <span style="font-weight: 600">${Number(value).toLocaleString()}</span>
    {:else if column === 'name'}
      <a href="/employees/{row.id}">{value}</a>
    {:else}
      {value ?? ''}
    {/if}
  </svelte:fragment>
</GridLite>
```

The cell slot receives `value` (cell value), `row` (full row object), and `column` (column name string). When no cell slot is provided, `format()` is used as fallback.

## Custom Toolbar Buttons

Inject buttons into the toolbar with `toolbar-start` and `toolbar-end` slots:

```svelte
<GridLite {db} table="employees" config={{ id: 'grid' }}>
  <svelte:fragment slot="toolbar-start">
    <button on:click={saveView}>Save View</button>
  </svelte:fragment>
  <svelte:fragment slot="toolbar-end">
    <button on:click={exportCSV}>Export CSV</button>
    <button on:click={reparse}>Reparse</button>
  </svelte:fragment>
</GridLite>
```

Works with all `toolbarLayout` presets including `aggrid`.

## Row Click Handler

```svelte
<GridLite
  onRowClick={(row) => {
    selectedEmployee = row;
    showSidebar = true;
  }}
/>
```

## Row Detail Modal

Default (auto-generated key-value layout):

```svelte
<GridLite
  features={{ rowDetail: true }}
  config={{
    id: 'grid',
    columns: [
      { name: 'name', label: 'Full Name' },
      { name: 'email', label: 'Email Address' }
    ]
  }}
/>
```

Custom row detail content via `row-detail` slot:

```svelte
<GridLite {db} table="employees" config={{ id: 'grid' }} features={{ rowDetail: true }}>
  <div slot="row-detail" let:row let:close>
    <h3>{row.name}</h3>
    <dl>
      <dt>Email</dt><dd>{row.email}</dd>
      <dt>Department</dt><dd>{row.department}</dd>
    </dl>
    <button on:click={close}>Close</button>
  </div>
</GridLite>
```

Click any row to open a detail modal with prev/next navigation.

## Raw SQL Query Mode

Use `query` instead of `table` for joins, CTEs, or custom SQL:

```svelte
<GridLite
  {db}
  query={`
    SELECT e.name, e.salary, d.name AS department_name
    FROM employees e
    JOIN departments d ON e.department_id = d.id
    WHERE e.active = true
    ORDER BY e.name
  `}
  config={{ id: 'joined-grid' }}
/>
```

**Note:** Raw query mode disables FilterBar, SortBar, GroupBar, and global search (no table to introspect). Pagination still works if the query supports it.

## Connecting to Existing PGLite Instance

```svelte
<script>
  // Shared PGLite instance (e.g., from a store or context)
  import { getContext } from 'svelte';
  import type { PGliteWithLive } from '@shotleybuilder/svelte-gridlite-kit';

  const db = getContext<PGliteWithLive>('pglite');
</script>

<GridLite {db} table="my_table" config={{ id: 'grid' }} />
```

## Persistent Database (IndexedDB)

```typescript
import { PGlite } from '@electric-sql/pglite';
import { live } from '@electric-sql/pglite/live';

// Data persists across page refreshes
const db = new PGlite('idb://my-app-db', { extensions: { live } });
```

## External Data Loading

```typescript
onMount(async () => {
  db = new PGlite({ extensions: { live } });

  await db.exec(`CREATE TABLE products (...)`);

  // Fetch from API and insert into PGLite
  const response = await fetch('/api/products');
  const products = await response.json();

  for (const p of products) {
    await db.query(
      'INSERT INTO products (name, price, category) VALUES ($1, $2, $3)',
      [p.name, p.price, p.category]
    );
  }

  ready = true;
});
```

## Using Built-in Formatters

```typescript
import {
  formatDate,
  formatCurrency,
  formatNumber,
  formatPercent
} from '@shotleybuilder/svelte-gridlite-kit';

const columns = [
  { name: 'created_at', format: (v) => formatDate(v, 'short') },
  { name: 'price', format: (v) => formatCurrency(v, 'USD') },
  { name: 'quantity', format: (v) => formatNumber(v, 0) },
  { name: 'growth', format: (v) => formatPercent(v, 1) }
];
```

## Fuzzy Search Utility

```typescript
import { fuzzySearch } from '@shotleybuilder/svelte-gridlite-kit';

// Search an array of items (useful outside GridLite)
const results = fuzzySearch(items, 'query', {
  keys: ['name', 'description'],
  threshold: 0.3
});
```

## Schema Introspection

```typescript
import { introspectTable } from '@shotleybuilder/svelte-gridlite-kit';

const columns = await introspectTable(db, 'employees');
// [{ name: 'id', dataType: 'number', postgresType: 'integer', ... }, ...]
```
