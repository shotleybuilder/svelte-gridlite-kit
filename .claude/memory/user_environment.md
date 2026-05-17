---
name: Bluefin Fedora environment
description: User runs Bluefin Fedora; pnpm must be invoked via `npx pnpm` (no global pnpm install)
type: user
---

User's OS is Bluefin Fedora (immutable Fedora variant). Node/npm are via linuxbrew.
pnpm is NOT installed globally — always invoke as `npx pnpm` (e.g. `npx pnpm test:run`).
