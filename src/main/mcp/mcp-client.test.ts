import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue("/tmp") },
}));

const mockSettings = {
  aiProvider: "anthropic" as const,
  aiApiKey: "test-key",
  aiModel: "claude-sonnet-4-20250514",
  aiBaseUrl: "",
};

vi.mock("../store", () => ({
  getSettings: vi.fn(() => ({ ...mockSettings })),
}));

import { McpAiClient } from "./mcp-client";
import { getSettings } from "../store";

describe("McpAiClient", () => {
  let client: McpAiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new McpAiClient();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("throws when provider is none", async () => {
    vi.mocked(getSettings).mockReturnValue({ ...mockSettings, aiProvider: "none" } as never);
    await expect(
      client.generateCommitMessage("diff", {
        staged: [],
        unstaged: [],
        untracked: [],
        mergeInProgress: false,
        conflicted: [],
        operationInProgress: null,
      })
    ).rejects.toThrow("No AI provider configured");
  });

  it("throws when API key is missing", async () => {
    vi.mocked(getSettings).mockReturnValue({ ...mockSettings, aiApiKey: "" } as never);
    await expect(
      client.generateCommitMessage("diff", {
        staged: [],
        unstaged: [],
        untracked: [],
        mergeInProgress: false,
        conflicted: [],
        operationInProgress: null,
      })
    ).rejects.toThrow("API key not configured");
  });

  it("calls Anthropic API with correct headers for commit message", async () => {
    vi.mocked(getSettings).mockReturnValue(mockSettings as never);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "feat: add feature" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.generateCommitMessage("diff content", {
      staged: [{ path: "src/a.ts", status: "modified" }],
      unstaged: [],
      untracked: [],
      mergeInProgress: false,
      conflicted: [],
      operationInProgress: null,
    });

    expect(result).toBe("feat: add feature");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-key",
          "anthropic-version": "2023-06-01",
        }),
      })
    );
  });

  it("calls OpenAI API for commit message", async () => {
    vi.mocked(getSettings).mockReturnValue({
      ...mockSettings,
      aiProvider: "openai",
      aiModel: "gpt-4o",
    } as never);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "fix: bug" } }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.generateCommitMessage("diff", {
      staged: [],
      unstaged: [],
      untracked: [],
      mergeInProgress: false,
      conflicted: [],
      operationInProgress: null,
    });

    expect(result).toBe("fix: bug");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    );
  });

  it("uses custom base URL for OpenAI", async () => {
    vi.mocked(getSettings).mockReturnValue({
      ...mockSettings,
      aiProvider: "openai",
      aiModel: "gpt-4o",
      aiBaseUrl: "https://custom.api.com",
    } as never);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "test" } }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await client.generateCommitMessage("diff", {
      staged: [],
      unstaged: [],
      untracked: [],
      mergeInProgress: false,
      conflicted: [],
      operationInProgress: null,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://custom.api.com/v1/chat/completions",
      expect.anything()
    );
  });

  it("calls Gemini API for commit message", async () => {
    vi.mocked(getSettings).mockReturnValue({
      ...mockSettings,
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
    } as never);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ candidates: [{ content: { parts: [{ text: "feat: new thing" }] } }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.generateCommitMessage("diff", {
      staged: [],
      unstaged: [],
      untracked: [],
      mergeInProgress: false,
      conflicted: [],
      operationInProgress: null,
    });

    expect(result).toBe("feat: new thing");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("handles Gemini API errors", async () => {
    vi.mocked(getSettings).mockReturnValue({
      ...mockSettings,
      aiProvider: "gemini",
      aiModel: "gemini-2.5-flash",
    } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: () => Promise.resolve("Forbidden"),
      })
    );

    await expect(
      client.generateCommitMessage("diff", {
        staged: [],
        unstaged: [],
        untracked: [],
        mergeInProgress: false,
        conflicted: [],
        operationInProgress: null,
      })
    ).rejects.toThrow("Gemini API error (403)");
  });

  it("handles Anthropic API errors", async () => {
    vi.mocked(getSettings).mockReturnValue(mockSettings as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      })
    );

    await expect(
      client.generateCommitMessage("diff", {
        staged: [],
        unstaged: [],
        untracked: [],
        mergeInProgress: false,
        conflicted: [],
        operationInProgress: null,
      })
    ).rejects.toThrow("Anthropic API error (401)");
  });

  it("suggestConflictResolution calls AI with file content", async () => {
    vi.mocked(getSettings).mockReturnValue(mockSettings as never);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "merged content" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.suggestConflictResolution("ours", "theirs", "base", "file.ts");
    expect(result).toBe("merged content");

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.messages[0].content).toContain("file.ts");
    expect(body.messages[0].content).toContain("OURS");
    expect(body.messages[0].content).toContain("THEIRS");
  });

  it("generatePrTitle calls AI with commits and diff", async () => {
    vi.mocked(getSettings).mockReturnValue(mockSettings as never);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "Add user authentication" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.generatePrTitle(
      [
        {
          hash: "abc",
          abbreviatedHash: "abc",
          subject: "feat: add auth",
          body: "",
          authorName: "",
          authorEmail: "",
          authorDate: "",
          committerDate: "",
          parentHashes: [],
          refs: [],
        },
      ],
      "diff content"
    );
    expect(result).toBe("Add user authentication");

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.messages[0].content).toContain("feat: add auth");
  });

  it("generatePrDescription includes template when provided", async () => {
    vi.mocked(getSettings).mockReturnValue(mockSettings as never);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "filled template" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const template = "## What\n\n## Why\n";
    const result = await client.generatePrDescription(
      [
        {
          hash: "abc",
          abbreviatedHash: "abc",
          subject: "fix: bug",
          body: "",
          authorName: "",
          authorEmail: "",
          authorDate: "",
          committerDate: "",
          parentHashes: [],
          refs: [],
        },
      ],
      "diff",
      template
    );
    expect(result).toBe("filled template");

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.messages[0].content).toContain("## What");
    expect(body.messages[0].content).toContain("PR template");
  });

  it("generatePrDescription uses default format without template", async () => {
    vi.mocked(getSettings).mockReturnValue(mockSettings as never);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "default desc" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.generatePrDescription(
      [
        {
          hash: "abc",
          abbreviatedHash: "abc",
          subject: "fix: bug",
          body: "",
          authorName: "",
          authorEmail: "",
          authorDate: "",
          committerDate: "",
          parentHashes: [],
          refs: [],
        },
      ],
      "diff"
    );
    expect(result).toBe("default desc");

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.messages[0].content).toContain("## Summary");
    expect(body.messages[0].content).toContain("## Test plan");
  });

  it("reviewCommit calls AI with hash and diff", async () => {
    vi.mocked(getSettings).mockReturnValue(mockSettings as never);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: "review text" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.reviewCommit("abc123", "diff text", [
      { path: "src/a.ts", status: "modified", additions: 5, deletions: 2 },
    ]);
    expect(result).toBe("review text");

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.messages[0].content).toContain("abc123");
  });
});
