import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    conditions: ["node"],
    mainFields: ["module", "jsnext:main", "jsnext"],
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "main.js",
      },
    },
  },
});
