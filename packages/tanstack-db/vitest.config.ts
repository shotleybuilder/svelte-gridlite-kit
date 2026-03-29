import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shotleybuilder/svelte-gridlite-kit/types": path.resolve(
        __dirname,
        "../core/src/lib/types.ts",
      ),
      "@shotleybuilder/svelte-gridlite-kit/schema": path.resolve(
        __dirname,
        "../core/src/lib/query/schema.ts",
      ),
      "@shotleybuilder/svelte-gridlite-kit/adapter": path.resolve(
        __dirname,
        "../core/src/lib/adapter.ts",
      ),
      "@shotleybuilder/svelte-gridlite-kit/builder": path.resolve(
        __dirname,
        "../core/src/lib/query/builder.ts",
      ),
      "@shotleybuilder/svelte-gridlite-kit": path.resolve(
        __dirname,
        "../core/src/lib/index.ts",
      ),
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
  },
});
