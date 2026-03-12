# Session 10: Integration Testing, Demo App & Package Prep

**Started**: 2026-03-12
**Plan**: `.claude/plans/build-plan.md` — Session 10

## Todo
- [ ] Fix PGLite demo — disable SSR, add optimizeDeps.exclude, add error handling
- [ ] Fix demo app styling — gridlite.css not loading on wide-table page
- [ ] Add error handling to both demo pages
- [ ] Package build — `npm run package` + publint validation
- [ ] Final index.ts exports audit
- [ ] README — add usage examples, install instructions, update status
- [ ] Verify all project artifacts for npm publish (package.json, exports, files)
- [ ] Run full check + test suite

## Notes
- PGLite hangs because no `ssr = false` and no `optimizeDeps.exclude`
- wide-table page missing `$lib/styles/gridlite.css` import
- Need `src/routes/+layout.ts` with `export const ssr = false`
