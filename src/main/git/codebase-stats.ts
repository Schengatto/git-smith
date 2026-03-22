import * as path from "path";
import * as fs from "fs/promises";
import type { SimpleGit } from "simple-git";
import type {
  CodebaseStats,
  LanguageStat,
  TypeStat,
  FileType,
} from "../../shared/codebase-stats-types";

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".zip",
  ".tar",
  ".gz",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".pdf",
  ".lock",
]);

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // Web/Frontend
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".html": "HTML",
  ".svg": "SVG",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  // Backend
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".scala": "Scala",
  ".rb": "Ruby",
  ".php": "PHP",
  ".cs": "C#",
  ".fs": "F#",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".clj": "Clojure",
  ".erl": "Erlang",
  ".hs": "Haskell",
  // Systems
  ".c": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".cxx": "C++",
  ".h": "C",
  ".hpp": "C++",
  ".zig": "Zig",
  ".nim": "Nim",
  ".d": "D",
  // Shell/Script
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".fish": "Fish",
  ".ps1": "PowerShell",
  ".bat": "Batch",
  ".cmd": "Batch",
  // Data/Config
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".xml": "XML",
  ".ini": "INI",
  ".env": "Env",
  // Mobile
  ".swift": "Swift",
  ".m": "Objective-C",
  ".mm": "Objective-C",
  ".dart": "Dart",
  // Other
  ".sql": "SQL",
  ".graphql": "GraphQL",
  ".proto": "Protobuf",
  ".r": "R",
  ".R": "R",
  ".lua": "Lua",
  ".perl": "Perl",
  ".pl": "Perl",
  ".groovy": "Groovy",
  ".tf": "Terraform",
  ".hcl": "HCL",
  // Docs
  ".md": "Markdown",
  ".txt": "Text",
  ".rst": "reStructuredText",
  ".adoc": "AsciiDoc",
  // Styl
  ".styl": "Stylus",
};

const STYLE_EXTENSIONS = new Set([".css", ".scss", ".sass", ".less", ".styl"]);
const DOC_EXTENSIONS = new Set([".md", ".txt", ".rst", ".adoc"]);
const DOC_FILENAMES = new Set(["LICENSE", "CHANGELOG"]);
const CONFIG_PATTERNS = [/\.config\.\w+$/, /tsconfig.*\.json$/, /\.eslintrc/, /\.prettierrc/];
const CONFIG_FILENAMES = new Set([
  "package.json",
  "Dockerfile",
  "Makefile",
  ".editorconfig",
  ".gitignore",
  ".gitattributes",
]);
const CICD_PATH_PREFIXES = [".github/", ".circleci/"];
const CICD_FILENAMES = new Set(["Jenkinsfile"]);
const CICD_PATTERNS = [/\.gitlab-ci/];

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#89b4fa",
  JavaScript: "#f9e2af",
  Python: "#a6e3a1",
  Go: "#94e2d5",
  Rust: "#fab387",
  Java: "#f38ba8",
  "C#": "#cba6f7",
  "C++": "#89dceb",
  C: "#74c7ec",
  Ruby: "#f38ba8",
  PHP: "#cba6f7",
  Kotlin: "#fab387",
  Scala: "#f38ba8",
  Swift: "#fab387",
  Dart: "#89b4fa",
  HTML: "#fab387",
  CSS: "#89b4fa",
  SCSS: "#f38ba8",
  Sass: "#f38ba8",
  Less: "#89b4fa",
  JSON: "#f9e2af",
  YAML: "#a6e3a1",
  TOML: "#fab387",
  XML: "#fab387",
  Shell: "#a6e3a1",
  PowerShell: "#89b4fa",
  SQL: "#89dceb",
  GraphQL: "#f38ba8",
  Markdown: "#a6adc8",
  Vue: "#a6e3a1",
  Svelte: "#fab387",
  SVG: "#f9e2af",
  Lua: "#89b4fa",
  Perl: "#94e2d5",
  Groovy: "#a6e3a1",
  Terraform: "#cba6f7",
  Elixir: "#cba6f7",
  Clojure: "#a6e3a1",
  Haskell: "#cba6f7",
  Erlang: "#f38ba8",
  "F#": "#89b4fa",
  Zig: "#fab387",
  Nim: "#f9e2af",
  D: "#f38ba8",
  R: "#89b4fa",
  Protobuf: "#a6adc8",
  HCL: "#cba6f7",
  Fish: "#94e2d5",
  Batch: "#a6adc8",
  "Objective-C": "#89b4fa",
  Text: "#6c7086",
  reStructuredText: "#a6adc8",
  AsciiDoc: "#a6adc8",
  INI: "#a6adc8",
  Env: "#a6adc8",
  Stylus: "#a6e3a1",
};

const TYPE_COLORS: Record<FileType, string> = {
  source: "#89b4fa",
  test: "#a6e3a1",
  config: "#fab387",
  styles: "#f38ba8",
  docs: "#cba6f7",
  cicd: "#f9e2af",
  other: "#6c7086",
};

const DEFAULT_LANGUAGE_COLOR = "#6c7086";
const BATCH_SIZE = 50;

export function isBinary(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

export function getLanguage(filePath: string): string | null {
  if (isBinary(filePath)) return null;
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] ?? null;
}

export function getFileType(filePath: string): FileType {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const normalizedPath = filePath.replace(/\\/g, "/");

  // CI/CD — path-based
  for (const prefix of CICD_PATH_PREFIXES) {
    if (normalizedPath.startsWith(prefix)) return "cicd";
  }
  if (CICD_FILENAMES.has(basename)) return "cicd";
  for (const pattern of CICD_PATTERNS) {
    if (pattern.test(normalizedPath)) return "cicd";
  }

  // Test
  if (/\.(test|spec)\.\w+$/.test(basename)) return "test";
  if (/(^|\/)(__|)tests?(__|\/)/.test(normalizedPath) || /(^|\/)spec\//.test(normalizedPath))
    return "test";

  // Styles
  if (STYLE_EXTENSIONS.has(ext)) return "styles";

  // Docs
  if (DOC_EXTENSIONS.has(ext) || DOC_FILENAMES.has(basename)) return "docs";

  // Config
  if (CONFIG_FILENAMES.has(basename)) return "config";
  for (const pattern of CONFIG_PATTERNS) {
    if (pattern.test(basename)) return "config";
  }
  if (ext === ".yml" || ext === ".yaml") return "config";
  if (basename.startsWith(".") && (ext === ".json" || ext === ".js" || ext === ".cjs"))
    return "config";

  // Source (has recognized language)
  if (getLanguage(filePath) !== null) return "source";

  return "other";
}

async function countLines(repoPath: string, filePath: string): Promise<number> {
  try {
    const fullPath = path.join(repoPath, filePath);
    const content = await fs.readFile(fullPath, "utf-8");
    if (content.length === 0) return 0;
    const count = content.split("\n").length;
    return content.endsWith("\n") ? count - 1 : count;
  } catch {
    return 0;
  }
}

export async function getCodebaseStats(git: SimpleGit): Promise<CodebaseStats> {
  const output = await git.raw(["ls-files", "--cached"]);
  const allFiles = output.trim().split("\n").filter(Boolean);

  const files = allFiles.filter((f) => !isBinary(f));
  if (files.length === 0) {
    return {
      totalLines: 0,
      totalFiles: 0,
      languageCount: 0,
      byLanguage: [],
      byType: [],
      testRatio: { sourceLines: 0, testLines: 0, ratio: 0, percentage: 0 },
    };
  }

  const repoPath = (await git.raw(["rev-parse", "--show-toplevel"])).trim();

  const fileLinesMap: { file: string; lines: number }[] = [];
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (f) => ({ file: f, lines: await countLines(repoPath, f) }))
    );
    fileLinesMap.push(...results);
  }

  const langMap = new Map<string, { lines: number; files: number }>();
  const typeMap = new Map<FileType, { lines: number; files: number }>();

  let totalLines = 0;
  for (const { file, lines } of fileLinesMap) {
    totalLines += lines;
    const language = getLanguage(file);
    const fileType = getFileType(file);

    if (language) {
      const entry = langMap.get(language) ?? { lines: 0, files: 0 };
      entry.lines += lines;
      entry.files += 1;
      langMap.set(language, entry);
    }

    const typeEntry = typeMap.get(fileType) ?? { lines: 0, files: 0 };
    typeEntry.lines += lines;
    typeEntry.files += 1;
    typeMap.set(fileType, typeEntry);
  }

  const byLanguage: LanguageStat[] = Array.from(langMap.entries())
    .map(([language, data]) => ({
      language,
      lines: data.lines,
      files: data.files,
      percentage: totalLines > 0 ? Math.round((data.lines / totalLines) * 1000) / 10 : 0,
      color: LANGUAGE_COLORS[language] ?? DEFAULT_LANGUAGE_COLOR,
    }))
    .sort((a, b) => b.lines - a.lines);

  const allTypes: FileType[] = ["source", "test", "config", "styles", "docs", "cicd", "other"];
  const byType: TypeStat[] = allTypes
    .map((type) => {
      const data = typeMap.get(type) ?? { lines: 0, files: 0 };
      return { type, lines: data.lines, files: data.files, color: TYPE_COLORS[type] };
    })
    .filter((t) => t.lines > 0 || t.files > 0);

  const sourceLines = typeMap.get("source")?.lines ?? 0;
  const testLines = typeMap.get("test")?.lines ?? 0;
  const testRatio = {
    sourceLines,
    testLines,
    ratio: sourceLines > 0 ? Math.round((testLines / sourceLines) * 100) / 100 : 0,
    percentage:
      sourceLines + testLines > 0
        ? Math.round((testLines / (sourceLines + testLines)) * 1000) / 10
        : 0,
  };

  return {
    totalLines,
    totalFiles: fileLinesMap.length,
    languageCount: langMap.size,
    byLanguage,
    byType,
    testRatio,
  };
}
