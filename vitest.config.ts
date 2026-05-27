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
    include: ["tests/unit/**/*.test.ts"],
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
    },
  },
});
