/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer/**/*.{html,tsx,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          hover: "var(--surface-hover)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          dim: "var(--accent-dim)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
      },
      fontSize: {
        xs: "0.6875rem",
        sm: "0.8125rem",
        base: "0.875rem",
      },
    },
  },
  plugins: [],
};
