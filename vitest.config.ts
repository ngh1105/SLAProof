import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "**/types.ts",
        "lib/domain/fixtures.ts",
        "lib/storage/case-store.ts",
      ],
      // Conservative baseline — current run sits ~80% lines / 76% branches /
      // 84% functions / 80% statements. Keep thresholds slightly below so a
      // single failing test doesn't tank coverage and block PRs.
      thresholds: {
        lines: 75,
        functions: 80,
        branches: 70,
        statements: 75,
      },
    },
  },
});
