import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // @ts-expect-error vite 5/6 plugin type mismatch with @sveltejs/kit
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
  },
});
