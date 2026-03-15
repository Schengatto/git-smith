module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",     // New feature
        "fix",      // Bug fix
        "docs",     // Documentation only
        "style",    // Formatting, missing semicolons, etc. (no code change)
        "refactor", // Code change that neither fixes a bug nor adds a feature
        "perf",     // Performance improvement
        "test",     // Adding or updating tests
        "build",    // Build system or external dependencies
        "ci",       // CI configuration
        "chore",    // Other changes that don't modify src or test files
        "revert",   // Reverts a previous commit
      ],
    ],
    "subject-case": [2, "never", ["start-case", "pascal-case", "upper-case"]],
    "subject-max-length": [2, "always", 100],
    "body-max-line-length": [1, "always", 200],
  },
};
