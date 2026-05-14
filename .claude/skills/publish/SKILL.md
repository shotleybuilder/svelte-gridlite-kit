# Publish to npm

Publish all three svelte-gridlite-kit packages to npm. Use when releasing a new version.

## Packages (publish in this order)

1. `@shotleybuilder/svelte-gridlite-kit` — `packages/core/`
2. `@shotleybuilder/gridlite-adapter-pglite` — `packages/pglite/`
3. `@shotleybuilder/gridlite-adapter-tanstack-db` — `packages/tanstack-db/`

## Pre-publish checklist

1. **Build all packages:**
   ```bash
   CI=true npx pnpm build
   ```

2. **Run all tests:**
   ```bash
   CI=true npx pnpm test:run
   ```
   Expected: ~180 core + ~68 pglite + ~74 tanstack-db tests passing.

3. **Check versions are correct** in each `package.json`. If versions need bumping, update them before publishing. Adapter peer deps on core should use caret range (e.g. `^0.6.0`).

4. **Check what's already published** to avoid version conflicts:
   ```bash
   npm view @shotleybuilder/svelte-gridlite-kit version
   npm view @shotleybuilder/gridlite-adapter-pglite version
   npm view @shotleybuilder/gridlite-adapter-tanstack-db version
   ```

## Login

The user must log in to npm before publishing. Prompt them to run this themselves:

```bash
npm login
```

This is interactive (opens a browser) so the user must run it manually via `! npm login` in the prompt.

## Publish commands

Run from the monorepo root. npm will send an OTP to the registered email for each publish.

```bash
# Core first (adapters depend on it)
cd packages/core && npx pnpm publish --access public --no-git-checks && cd ../..

# Then adapters (order doesn't matter between these two)
cd packages/pglite && npx pnpm publish --access public --no-git-checks && cd ../..
cd packages/tanstack-db && npx pnpm publish --access public --no-git-checks && cd ../..
```

## Post-publish verification

```bash
npm view @shotleybuilder/svelte-gridlite-kit version
npm view @shotleybuilder/gridlite-adapter-pglite version
npm view @shotleybuilder/gridlite-adapter-tanstack-db version
```

## Notes

- The `CI=true` env var is needed because pnpm on this system (Fedora Bluefin, immutable OS) runs via `npx pnpm` and requires it to skip TTY prompts.
- Core has a `prepublishOnly` script that runs `svelte-package + publint` automatically.
- The demo package (`packages/demo/`) is private and is NOT published.
- **Must use `pnpm publish`, not `npm publish`.** pnpm resolves `workspace:^` references in peerDependencies to real semver ranges. `npm publish` leaks the raw `workspace:` protocol, breaking consumers (see issue #30).
- npm 2FA is configured with email OTP — you'll receive a code for each publish.
