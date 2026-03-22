export interface GitignoreTemplate {
  name: string;
  patterns: string[];
}

export const gitignoreTemplates: GitignoreTemplate[] = [
  {
    name: "Node.js",
    patterns: [
      "node_modules/",
      "dist/",
      "build/",
      ".env",
      ".env.local",
      "npm-debug.log*",
      "yarn-debug.log*",
      "yarn-error.log*",
      ".npm",
      ".yarn-integrity",
    ],
  },
  {
    name: "Python",
    patterns: [
      "__pycache__/",
      "*.py[cod]",
      "*$py.class",
      "*.so",
      ".Python",
      "env/",
      "venv/",
      ".venv/",
      "*.egg-info/",
      "dist/",
      ".eggs/",
      ".tox/",
      ".mypy_cache/",
    ],
  },
  {
    name: "Java",
    patterns: [
      "*.class",
      "*.jar",
      "*.war",
      "*.ear",
      "target/",
      ".gradle/",
      "build/",
      ".idea/",
      "*.iml",
      "out/",
    ],
  },
  {
    name: "Rust",
    patterns: ["target/", "Cargo.lock", "**/*.rs.bk"],
  },
  {
    name: "Go",
    patterns: [
      "bin/",
      "pkg/",
      "*.exe",
      "*.exe~",
      "*.dll",
      "*.so",
      "*.dylib",
      "*.test",
      "*.out",
      "vendor/",
    ],
  },
  {
    name: "C/C++",
    patterns: [
      "*.o",
      "*.obj",
      "*.so",
      "*.dll",
      "*.dylib",
      "*.exe",
      "*.out",
      "*.a",
      "*.lib",
      "build/",
      "cmake-build-*/",
    ],
  },
  {
    name: "macOS",
    patterns: [
      ".DS_Store",
      ".AppleDouble",
      ".LSOverride",
      "._*",
      ".Spotlight-V100",
      ".Trashes",
    ],
  },
  {
    name: "Windows",
    patterns: ["Thumbs.db", "ehthumbs.db", "Desktop.ini", "$RECYCLE.BIN/", "*.lnk"],
  },
  {
    name: "Linux",
    patterns: ["*~", ".fuse_hidden*", ".directory", ".Trash-*", ".nfs*"],
  },
  {
    name: "IDE",
    patterns: [
      ".idea/",
      ".vscode/",
      "*.swp",
      "*.swo",
      "*~",
      ".project",
      ".classpath",
      ".settings/",
      "*.sublime-workspace",
      "*.sublime-project",
    ],
  },
];
