import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Dedicated Vitest config (kept separate from the React Router Vite config) so
// the `~/` and `#` path aliases from tsconfig resolve inside tests. Tests target
// pure helpers, so a node environment is enough — no DOM/db needed.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
  },
});
