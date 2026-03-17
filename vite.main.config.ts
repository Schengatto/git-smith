import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["node"],
    mainFields: ["module", "jsnext:main", "jsnext"],
  },
  build: {
    rollupOptions: {
      external: ["node-pty", "@modelcontextprotocol/sdk", "zod"],
      output: {
        entryFileNames: "main.js",
      },
    },
  },
});
