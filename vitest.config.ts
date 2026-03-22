import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify("0.0.0-test"),
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/preload/**",
        "src/main/index.ts",
        "src/main/mcp/mcp-entry.ts",
        "src/renderer/index.tsx",
        "src/renderer/App.tsx",
        "src/renderer/components/ErrorBoundary.tsx",
        "src/shared/*-types.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 74,
        branches: 72,
        statements: 80,
      },
    },
  },
});
