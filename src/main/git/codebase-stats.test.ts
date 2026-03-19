import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs/promises";
import type { SimpleGit } from "simple-git";
import { getLanguage, getFileType, getCodebaseStats } from "./codebase-stats";

// --- Pure function tests (no mocks needed) ---

describe("getLanguage", () => {
  it("detects TypeScript from .ts extension", () => {
    expect(getLanguage("src/main/app.ts")).toBe("TypeScript");
  });
  it("detects TSX from .tsx extension", () => {
    expect(getLanguage("src/renderer/App.tsx")).toBe("TypeScript");
  });
  it("detects Python from .py extension", () => {
    expect(getLanguage("scripts/build.py")).toBe("Python");
  });
  it("detects Go from .go extension", () => {
    expect(getLanguage("cmd/main.go")).toBe("Go");
  });
  it("detects Rust from .rs extension", () => {
    expect(getLanguage("src/lib.rs")).toBe("Rust");
  });
  it("detects CSS from .css extension", () => {
    expect(getLanguage("styles/app.css")).toBe("CSS");
  });
  it("detects YAML from .yml extension", () => {
    expect(getLanguage("config.yml")).toBe("YAML");
  });
  it("detects Shell from .sh extension", () => {
    expect(getLanguage("scripts/deploy.sh")).toBe("Shell");
  });
  it("returns null for unknown extension", () => {
    expect(getLanguage("file.xyz")).toBeNull();
  });
  it("returns null for binary extensions", () => {
    expect(getLanguage("image.png")).toBeNull();
  });
});

describe("getFileType", () => {
  it("classifies .test.ts as test", () => {
    expect(getFileType("src/app.test.ts")).toBe("test");
  });
  it("classifies .spec.tsx as test", () => {
    expect(getFileType("src/app.spec.tsx")).toBe("test");
  });
  it("classifies __tests__/ files as test", () => {
    expect(getFileType("src/__tests__/app.ts")).toBe("test");
  });
  it("classifies .github/ files as cicd", () => {
    expect(getFileType(".github/workflows/ci.yml")).toBe("cicd");
  });
  it("classifies .circleci/ files as cicd", () => {
    expect(getFileType(".circleci/config.yml")).toBe("cicd");
  });
  it("classifies Jenkinsfile as cicd", () => {
    expect(getFileType("Jenkinsfile")).toBe("cicd");
  });
  it("classifies .css as styles", () => {
    expect(getFileType("src/index.css")).toBe("styles");
  });
  it("classifies .scss as styles", () => {
    expect(getFileType("src/theme.scss")).toBe("styles");
  });
  it("classifies .md as docs", () => {
    expect(getFileType("README.md")).toBe("docs");
  });
  it("classifies LICENSE as docs", () => {
    expect(getFileType("LICENSE")).toBe("docs");
  });
  it("classifies *.config.ts as config", () => {
    expect(getFileType("vite.config.ts")).toBe("config");
  });
  it("classifies package.json as config", () => {
    expect(getFileType("package.json")).toBe("config");
  });
  it("classifies tsconfig.json as config", () => {
    expect(getFileType("tsconfig.json")).toBe("config");
  });
  it("classifies Dockerfile as config", () => {
    expect(getFileType("Dockerfile")).toBe("config");
  });
  it("classifies root .yml as config (not cicd)", () => {
    expect(getFileType("docker-compose.yml")).toBe("config");
  });
  it("classifies .eslintrc.json as config", () => {
    expect(getFileType(".eslintrc.json")).toBe("config");
  });
  it("classifies regular .ts as source", () => {
    expect(getFileType("src/main/app.ts")).toBe("source");
  });
  it("classifies unknown extension as other", () => {
    expect(getFileType("file.xyz")).toBe("other");
  });
});

// --- Integration tests (with mocks) ---

const mockRaw = vi.fn();
const mockGit = { raw: mockRaw } as unknown as SimpleGit;

vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));

describe("getCodebaseStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts lines per language and type", async () => {
    mockRaw
      .mockResolvedValueOnce("src/app.ts\nsrc/app.test.ts\nsrc/index.css\n")
      .mockResolvedValueOnce("/test/repo\n");
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile
      .mockResolvedValueOnce("line1\nline2\nline3\n" as never)
      .mockResolvedValueOnce("test1\ntest2\n" as never)
      .mockResolvedValueOnce("body{}\n" as never);

    const stats = await getCodebaseStats(mockGit);

    expect(stats.totalLines).toBe(6);
    expect(stats.totalFiles).toBe(3);
    expect(stats.byLanguage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language: "TypeScript", lines: 5, files: 2 }),
        expect.objectContaining({ language: "CSS", lines: 1, files: 1 }),
      ])
    );
    expect(stats.byType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "source", lines: 3 }),
        expect.objectContaining({ type: "test", lines: 2 }),
        expect.objectContaining({ type: "styles", lines: 1 }),
      ])
    );
    expect(stats.testRatio.sourceLines).toBe(3);
    expect(stats.testRatio.testLines).toBe(2);
  });

  it("skips binary files", async () => {
    mockRaw
      .mockResolvedValueOnce("src/app.ts\nimage.png\n")
      .mockResolvedValueOnce("/test/repo\n");
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile.mockResolvedValueOnce("line1\nline2\n" as never);

    const stats = await getCodebaseStats(mockGit);

    expect(stats.totalFiles).toBe(1);
    expect(stats.totalLines).toBe(2);
    expect(mockReadFile).toHaveBeenCalledTimes(1);
  });

  it("handles empty repo", async () => {
    mockRaw.mockResolvedValueOnce("");

    const stats = await getCodebaseStats(mockGit);

    expect(stats.totalFiles).toBe(0);
    expect(stats.totalLines).toBe(0);
    expect(stats.byLanguage).toEqual([]);
  });

  it("sorts languages by lines descending", async () => {
    mockRaw
      .mockResolvedValueOnce("a.ts\nb.py\n")
      .mockResolvedValueOnce("/test/repo\n");
    const mockReadFile = vi.mocked(fs.readFile);
    mockReadFile
      .mockResolvedValueOnce("1\n2\n" as never)
      .mockResolvedValueOnce("1\n2\n3\n" as never);

    const stats = await getCodebaseStats(mockGit);

    expect(stats.byLanguage[0].language).toBe("Python");
    expect(stats.byLanguage[1].language).toBe("TypeScript");
  });
});
