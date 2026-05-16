# Publish to npm

Prepare a release and give the user the commands to publish. **Claude CANNOT run publish commands** — they require interactive npm login and OTP. The output of this skill is the commands for the user to copy-paste.

## Packages (publish in this order)

1. `@shotleybuilder/svelte-gridlite-kit` — `packages/core/`
2. `@shotleybuilder/gridlite-adapter-pglite` — `packages/pglite/`
3. `@shotleybuilder/gridlite-adapter-tanstack-db` — `packages/tanstack-db/`

Only publish packages whose version has actually changed.

## What Claude should do

1. **Build all packages:**
   ```bash
   CI=true npx pnpm build
   ```

2. **Run all tests:**
   ```bash
   CI=true npx pnpm -r test:run
   ```

3. **Check what's already published** to determine which packages need publishing:
   ```bash
   npm view @shotleybuilder/svelte-gridlite-kit version
   npm view @shotleybuilder/gridlite-adapter-pglite version
   npm view @shotleybuilder/gridlite-adapter-tanstack-db version
   ```

4. **Output the publish commands** for only the packages that have new versions. Do NOT attempt to run them.

## Publish commands (for the user to run)

```bash
# Core first (adapters depend on it)
cd packages/core && npx pnpm publish --access public --no-git-checks && cd ../..

# Then adapters (order doesn't matter between these two)
cd packages/pglite && npx pnpm publish --access public --no-git-checks && cd ../..
cd packages/tanstack-db && npx pnpm publish --access public --no-git-checks && cd ../..
```

## Post-publish verification (for the user)

```bash
npm view @shotleybuilder/svelte-gridlite-kit version
npm view @shotleybuilder/gridlite-adapter-pglite version
npm view @shotleybuilder/gridlite-adapter-tanstack-db version
```

## Notes

- **Claude CANNOT publish.** Publishing requires interactive npm login + email OTP. Always output commands for the user to run themselves.
- **Must use `pnpm publish`, not `npm publish`.** pnpm resolves `workspace:^` references in peerDependencies to real semver ranges. `npm publish` leaks the raw `workspace:` protocol, breaking consumers (see issue #30).
- The `CI=true` env var is needed because pnpm on this system (Fedora Bluefin, immutable OS) runs via `npx pnpm` and requires it to skip TTY prompts.
- Core has a `prepublishOnly` script that runs `svelte-package + publint` automatically.
- The demo package (`packages/demo/`) is private and is NOT published.
- npm 2FA is configured with email OTP — user receives a code for each publish.
