import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
  },
});
