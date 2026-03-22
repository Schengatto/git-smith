import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock https ─────────────────────────────────────────────────────────────

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn(),
}));

vi.mock("https", () => ({
  default: { request: mockRequest },
}));

// ── Imports ────────────────────────────────────────────────────────────────

import {
  githubListPrs,
  githubCreatePr,
  githubViewPr,
  githubGetCIStatus,
  gitlabListMrs,
  gitlabCreateMr,
  gitlabViewMr,
  gitlabGetCIStatus,
} from "./platform-api";

// ── Helpers ────────────────────────────────────────────────────────────────

function simulateResponse(status: number, body: unknown) {
  mockRequest.mockImplementation((_options: unknown, callback: (res: unknown) => void) => {
    const res = {
      statusCode: status,
      on: vi.fn((event: string, handler: (data?: unknown) => void) => {
        if (event === "data") handler(Buffer.from(JSON.stringify(body)));
        if (event === "end") handler();
      }),
    };
    callback(res);
    return { on: vi.fn(), write: vi.fn(), end: vi.fn() };
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("platform-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GitHub ──────────────────────────────────────────────────────────────

  describe("githubListPrs", () => {
    it("returns mapped PRs on success", async () => {
      simulateResponse(200, [
        {
          number: 1,
          title: "Test PR",
          state: "open",
          user: { login: "alice" },
          html_url: "https://github.com/owner/repo/pull/1",
          created_at: "2024-01-01",
          updated_at: "2024-01-02",
          head: { ref: "feature" },
          base: { ref: "main" },
          labels: [{ name: "bug" }],
        },
      ]);

      const result = await githubListPrs("owner", "repo", "token");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        number: 1,
        title: "Test PR",
        state: "open",
        author: "alice",
        sourceBranch: "feature",
        targetBranch: "main",
        labels: ["bug"],
      });
    });

    it("throws on non-200 response", async () => {
      simulateResponse(401, { message: "Bad credentials" });
      await expect(githubListPrs("o", "r", "bad")).rejects.toThrow("GitHub API error 401");
    });
  });

  describe("githubCreatePr", () => {
    it("returns PR URL on success", async () => {
      simulateResponse(201, { html_url: "https://github.com/owner/repo/pull/42" });

      const url = await githubCreatePr("owner", "repo", "token", {
        title: "New PR",
        body: "Description with (special) chars",
        targetBranch: "main",
        sourceBranch: "feature",
      });
      expect(url).toBe("https://github.com/owner/repo/pull/42");
    });

    it("throws on non-201 response", async () => {
      simulateResponse(422, { message: "Validation Failed" });
      await expect(
        githubCreatePr("o", "r", "t", {
          title: "x",
          body: "y",
          targetBranch: "main",
          sourceBranch: "feat",
        })
      ).rejects.toThrow("Failed to create PR");
    });

    it("sends draft flag in payload", async () => {
      simulateResponse(201, { html_url: "https://github.com/owner/repo/pull/1" });

      await githubCreatePr("owner", "repo", "token", {
        title: "Draft PR",
        body: "body",
        targetBranch: "main",
        sourceBranch: "feat",
        draft: true,
      });

      const writeCall = mockRequest.mock.results[0]?.value;
      expect(writeCall.write).toHaveBeenCalled();
      const payload = JSON.parse(writeCall.write.mock.calls[0][0]);
      expect(payload.draft).toBe(true);
    });
  });

  describe("githubViewPr", () => {
    it("returns formatted PR details", async () => {
      simulateResponse(200, {
        number: 5,
        title: "My PR",
        state: "open",
        user: { login: "bob" },
        head: { ref: "feature" },
        base: { ref: "main" },
        html_url: "https://github.com/owner/repo/pull/5",
        body: "PR body text",
      });

      const result = await githubViewPr("owner", "repo", "token", 5);
      expect(result).toContain("#5: My PR");
      expect(result).toContain("State: open");
      expect(result).toContain("Author: bob");
      expect(result).toContain("PR body text");
    });
  });

  describe("githubGetCIStatus", () => {
    it("maps workflow runs to CIStatus format", async () => {
      simulateResponse(200, {
        workflow_runs: [
          {
            name: "CI",
            status: "completed",
            conclusion: "success",
            html_url: "https://github.com/runs/1",
            run_started_at: "2024-01-01",
          },
          {
            name: "Build",
            status: "in_progress",
            conclusion: null,
            html_url: "https://github.com/runs/2",
            run_started_at: "2024-01-01",
          },
        ],
      });

      const result = await githubGetCIStatus("owner", "repo", "token", "sha123");
      expect(result).toHaveLength(2);
      expect(result[0]!.status).toBe("success");
      expect(result[1]!.status).toBe("running");
    });

    it("returns empty array on API error", async () => {
      simulateResponse(500, {});
      const result = await githubGetCIStatus("o", "r", "t", "sha");
      expect(result).toEqual([]);
    });
  });

  // ── GitLab ──────────────────────────────────────────────────────────────

  describe("gitlabListMrs", () => {
    it("returns mapped MRs on success", async () => {
      simulateResponse(200, [
        {
          iid: 10,
          title: "Test MR",
          state: "opened",
          author: { username: "carol" },
          web_url: "https://gitlab.com/owner/repo/-/merge_requests/10",
          created_at: "2024-01-01",
          updated_at: "2024-01-02",
          source_branch: "feature",
          target_branch: "main",
          labels: ["enhancement"],
        },
      ]);

      const result = await gitlabListMrs("owner", "repo", "token");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        number: 10,
        title: "Test MR",
        author: "carol",
        sourceBranch: "feature",
        labels: ["enhancement"],
      });
    });
  });

  describe("gitlabCreateMr", () => {
    it("returns MR URL on success", async () => {
      simulateResponse(201, {
        web_url: "https://gitlab.com/owner/repo/-/merge_requests/11",
      });

      const url = await gitlabCreateMr("owner", "repo", "token", {
        title: "New MR",
        body: "Description",
        targetBranch: "main",
        sourceBranch: "feature",
      });
      expect(url).toBe("https://gitlab.com/owner/repo/-/merge_requests/11");
    });

    it("prepends Draft: to title when draft option is set", async () => {
      simulateResponse(201, { web_url: "https://gitlab.com/mr/1" });

      await gitlabCreateMr("owner", "repo", "token", {
        title: "My MR",
        body: "body",
        targetBranch: "main",
        sourceBranch: "feat",
        draft: true,
      });

      const writeCall = mockRequest.mock.results[0]?.value;
      const payload = JSON.parse(writeCall.write.mock.calls[0][0]);
      expect(payload.title).toBe("Draft: My MR");
    });
  });

  describe("gitlabViewMr", () => {
    it("returns formatted MR details", async () => {
      simulateResponse(200, {
        iid: 10,
        title: "My MR",
        state: "opened",
        author: { username: "dave" },
        source_branch: "feature",
        target_branch: "main",
        web_url: "https://gitlab.com/mr/10",
        description: "MR body text",
      });

      const result = await gitlabViewMr("owner", "repo", "token", 10);
      expect(result).toContain("!10: My MR");
      expect(result).toContain("Author: dave");
      expect(result).toContain("MR body text");
    });
  });

  describe("gitlabGetCIStatus", () => {
    it("maps pipeline statuses correctly", async () => {
      simulateResponse(200, [
        { sha: "abc", status: "success", web_url: "https://gl/p/1", created_at: "2024-01-01" },
        { sha: "abc", status: "failed", web_url: "https://gl/p/2", created_at: "2024-01-01" },
        { sha: "abc", status: "running", web_url: "https://gl/p/3", created_at: "2024-01-01" },
      ]);

      const result = await gitlabGetCIStatus("owner", "repo", "token", "abc");
      expect(result).toHaveLength(3);
      expect(result[0]!.status).toBe("success");
      expect(result[1]!.status).toBe("failure");
      expect(result[2]!.status).toBe("running");
    });

    it("returns empty array on API error", async () => {
      simulateResponse(500, {});
      const result = await gitlabGetCIStatus("o", "r", "t", "sha");
      expect(result).toEqual([]);
    });
  });
});
