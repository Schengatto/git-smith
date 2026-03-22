import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGenerateCommitMessage = vi.fn();
const mockSuggestConflictResolution = vi.fn();
const mockGeneratePrTitle = vi.fn();
const mockGeneratePrDescription = vi.fn();
const mockReviewCommit = vi.fn();
const mockServerStart = vi.fn();
const mockServerStop = vi.fn();
const mockServerStatus = vi.fn();

vi.stubGlobal("window", {
  electronAPI: {
    mcp: {
      generateCommitMessage: mockGenerateCommitMessage,
      suggestConflictResolution: mockSuggestConflictResolution,
      generatePrTitle: mockGeneratePrTitle,
      generatePrDescription: mockGeneratePrDescription,
      reviewCommit: mockReviewCommit,
      serverStart: mockServerStart,
      serverStop: mockServerStop,
      serverStatus: mockServerStatus,
    },
  },
});

import { useMcpStore } from "./mcp-store";

const resetStore = () => {
  useMcpStore.setState({
    generating: false,
    lastCommitSuggestion: null,
    lastConflictSuggestion: null,
    lastReview: null,
    lastPrDescription: null,
    lastPrTitle: null,
    error: null,
    serverRunning: false,
    serverRepoPath: null,
  });
};

describe("mcp-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe("initial state", () => {
    it("generating is false", () => {
      expect(useMcpStore.getState().generating).toBe(false);
    });

    it("lastCommitSuggestion is null", () => {
      expect(useMcpStore.getState().lastCommitSuggestion).toBeNull();
    });

    it("lastConflictSuggestion is null", () => {
      expect(useMcpStore.getState().lastConflictSuggestion).toBeNull();
    });

    it("lastReview is null", () => {
      expect(useMcpStore.getState().lastReview).toBeNull();
    });

    it("lastPrDescription is null", () => {
      expect(useMcpStore.getState().lastPrDescription).toBeNull();
    });

    it("lastPrTitle is null", () => {
      expect(useMcpStore.getState().lastPrTitle).toBeNull();
    });

    it("error is null", () => {
      expect(useMcpStore.getState().error).toBeNull();
    });

    it("serverRunning is false", () => {
      expect(useMcpStore.getState().serverRunning).toBe(false);
    });

    it("serverRepoPath is null", () => {
      expect(useMcpStore.getState().serverRepoPath).toBeNull();
    });
  });

  describe("generateCommitMessage", () => {
    it("returns the suggestion from the API", async () => {
      mockGenerateCommitMessage.mockResolvedValue("feat: add new feature");
      const result = await useMcpStore.getState().generateCommitMessage();
      expect(result).toBe("feat: add new feature");
    });

    it("stores the suggestion in lastCommitSuggestion", async () => {
      mockGenerateCommitMessage.mockResolvedValue("fix: resolve bug");
      await useMcpStore.getState().generateCommitMessage();
      expect(useMcpStore.getState().lastCommitSuggestion).toBe("fix: resolve bug");
    });

    it("sets generating to false after success", async () => {
      mockGenerateCommitMessage.mockResolvedValue("msg");
      await useMcpStore.getState().generateCommitMessage();
      expect(useMcpStore.getState().generating).toBe(false);
    });

    it("clears error before calling API", async () => {
      useMcpStore.setState({ error: "old error" });
      mockGenerateCommitMessage.mockResolvedValue("msg");
      await useMcpStore.getState().generateCommitMessage();
      expect(useMcpStore.getState().error).toBeNull();
    });

    it("sets error and re-throws on failure", async () => {
      mockGenerateCommitMessage.mockRejectedValue(new Error("AI unavailable"));
      await expect(useMcpStore.getState().generateCommitMessage()).rejects.toThrow(
        "AI unavailable"
      );
      expect(useMcpStore.getState().error).toBe("AI unavailable");
    });

    it("sets generating to false on failure", async () => {
      mockGenerateCommitMessage.mockRejectedValue(new Error("fail"));
      await expect(useMcpStore.getState().generateCommitMessage()).rejects.toThrow();
      expect(useMcpStore.getState().generating).toBe(false);
    });
  });

  describe("suggestConflictResolution", () => {
    it("returns the suggestion from the API", async () => {
      mockSuggestConflictResolution.mockResolvedValue("Accept incoming change");
      const result = await useMcpStore.getState().suggestConflictResolution("/src/foo.ts");
      expect(result).toBe("Accept incoming change");
    });

    it("calls the API with the file path", async () => {
      mockSuggestConflictResolution.mockResolvedValue("suggestion");
      await useMcpStore.getState().suggestConflictResolution("/src/bar.ts");
      expect(mockSuggestConflictResolution).toHaveBeenCalledWith("/src/bar.ts");
    });

    it("stores the suggestion in lastConflictSuggestion", async () => {
      mockSuggestConflictResolution.mockResolvedValue("use theirs");
      await useMcpStore.getState().suggestConflictResolution("/src/foo.ts");
      expect(useMcpStore.getState().lastConflictSuggestion).toBe("use theirs");
    });

    it("sets generating to false after success", async () => {
      mockSuggestConflictResolution.mockResolvedValue("ok");
      await useMcpStore.getState().suggestConflictResolution("/src/foo.ts");
      expect(useMcpStore.getState().generating).toBe(false);
    });

    it("sets error and re-throws on failure", async () => {
      mockSuggestConflictResolution.mockRejectedValue(new Error("timeout"));
      await expect(useMcpStore.getState().suggestConflictResolution("/f")).rejects.toThrow(
        "timeout"
      );
      expect(useMcpStore.getState().error).toBe("timeout");
    });

    it("sets generating to false on failure", async () => {
      mockSuggestConflictResolution.mockRejectedValue(new Error("fail"));
      await expect(useMcpStore.getState().suggestConflictResolution("/f")).rejects.toThrow();
      expect(useMcpStore.getState().generating).toBe(false);
    });
  });

  describe("generatePrDescription", () => {
    it("returns the description from the API", async () => {
      mockGeneratePrDescription.mockResolvedValue("## Summary\n- Added feature X");
      const result = await useMcpStore.getState().generatePrDescription("feature-branch", "main");
      expect(result).toBe("## Summary\n- Added feature X");
    });

    it("calls the API with source and target branches", async () => {
      mockGeneratePrDescription.mockResolvedValue("desc");
      await useMcpStore.getState().generatePrDescription("feature-branch", "main");
      expect(mockGeneratePrDescription).toHaveBeenCalledWith("feature-branch", "main");
    });

    it("stores the description in lastPrDescription", async () => {
      mockGeneratePrDescription.mockResolvedValue("PR body text");
      await useMcpStore.getState().generatePrDescription("feature-branch", "main");
      expect(useMcpStore.getState().lastPrDescription).toBe("PR body text");
    });

    it("sets generating to false after success", async () => {
      mockGeneratePrDescription.mockResolvedValue("ok");
      await useMcpStore.getState().generatePrDescription("feature-branch", "main");
      expect(useMcpStore.getState().generating).toBe(false);
    });

    it("sets error and re-throws on failure", async () => {
      mockGeneratePrDescription.mockRejectedValue(new Error("model error"));
      await expect(
        useMcpStore.getState().generatePrDescription("feature-branch", "main")
      ).rejects.toThrow("model error");
      expect(useMcpStore.getState().error).toBe("model error");
    });
  });

  describe("generatePrTitle", () => {
    it("returns the title from the API", async () => {
      mockGeneratePrTitle.mockResolvedValue("feat: add auth");
      const result = await useMcpStore.getState().generatePrTitle("feat-branch", "main");
      expect(result).toBe("feat: add auth");
    });

    it("stores the title in lastPrTitle", async () => {
      mockGeneratePrTitle.mockResolvedValue("fix: resolve bug");
      await useMcpStore.getState().generatePrTitle("fix-branch", "main");
      expect(useMcpStore.getState().lastPrTitle).toBe("fix: resolve bug");
    });

    it("sets error on failure", async () => {
      mockGeneratePrTitle.mockRejectedValue(new Error("API error"));
      await expect(useMcpStore.getState().generatePrTitle("branch", "main")).rejects.toThrow(
        "API error"
      );
      expect(useMcpStore.getState().error).toBe("API error");
    });
  });

  describe("reviewCommit", () => {
    it("returns the review text from the API", async () => {
      mockReviewCommit.mockResolvedValue("LGTM! Clean changes.");
      const result = await useMcpStore.getState().reviewCommit("abc123");
      expect(result).toBe("LGTM! Clean changes.");
    });

    it("calls the API with the commit hash", async () => {
      mockReviewCommit.mockResolvedValue("review");
      await useMcpStore.getState().reviewCommit("deadbeef");
      expect(mockReviewCommit).toHaveBeenCalledWith("deadbeef");
    });

    it("stores the review in lastReview", async () => {
      mockReviewCommit.mockResolvedValue("Looks good");
      await useMcpStore.getState().reviewCommit("abc123");
      expect(useMcpStore.getState().lastReview).toBe("Looks good");
    });

    it("sets generating to false after success", async () => {
      mockReviewCommit.mockResolvedValue("ok");
      await useMcpStore.getState().reviewCommit("hash");
      expect(useMcpStore.getState().generating).toBe(false);
    });

    it("sets error and re-throws on failure", async () => {
      mockReviewCommit.mockRejectedValue(new Error("review failed"));
      await expect(useMcpStore.getState().reviewCommit("hash")).rejects.toThrow("review failed");
      expect(useMcpStore.getState().error).toBe("review failed");
    });

    it("sets generating to false on failure", async () => {
      mockReviewCommit.mockRejectedValue(new Error("fail"));
      await expect(useMcpStore.getState().reviewCommit("hash")).rejects.toThrow();
      expect(useMcpStore.getState().generating).toBe(false);
    });
  });

  describe("startServer", () => {
    it("calls serverStart and sets serverRunning to true on success", async () => {
      mockServerStart.mockResolvedValue(undefined);
      await useMcpStore.getState().startServer();
      expect(mockServerStart).toHaveBeenCalledOnce();
      expect(useMcpStore.getState().serverRunning).toBe(true);
    });

    it("sets error on failure", async () => {
      mockServerStart.mockRejectedValue(new Error("port in use"));
      await useMcpStore.getState().startServer();
      expect(useMcpStore.getState().error).toBe("port in use");
      expect(useMcpStore.getState().serverRunning).toBe(false);
    });
  });

  describe("stopServer", () => {
    it("calls serverStop and sets serverRunning to false on success", async () => {
      useMcpStore.setState({ serverRunning: true, serverRepoPath: "/repo" });
      mockServerStop.mockResolvedValue(undefined);
      await useMcpStore.getState().stopServer();
      expect(mockServerStop).toHaveBeenCalledOnce();
      expect(useMcpStore.getState().serverRunning).toBe(false);
    });

    it("clears serverRepoPath after stopping", async () => {
      useMcpStore.setState({ serverRunning: true, serverRepoPath: "/repo" });
      mockServerStop.mockResolvedValue(undefined);
      await useMcpStore.getState().stopServer();
      expect(useMcpStore.getState().serverRepoPath).toBeNull();
    });

    it("sets error on failure", async () => {
      mockServerStop.mockRejectedValue(new Error("stop failed"));
      await useMcpStore.getState().stopServer();
      expect(useMcpStore.getState().error).toBe("stop failed");
    });
  });

  describe("refreshServerStatus", () => {
    it("fetches server status and updates serverRunning and serverRepoPath", async () => {
      mockServerStatus.mockResolvedValue({ running: true, repoPath: "/my/repo" });
      await useMcpStore.getState().refreshServerStatus();
      expect(useMcpStore.getState().serverRunning).toBe(true);
      expect(useMcpStore.getState().serverRepoPath).toBe("/my/repo");
    });

    it("reflects stopped server status", async () => {
      useMcpStore.setState({ serverRunning: true, serverRepoPath: "/repo" });
      mockServerStatus.mockResolvedValue({ running: false, repoPath: null });
      await useMcpStore.getState().refreshServerStatus();
      expect(useMcpStore.getState().serverRunning).toBe(false);
      expect(useMcpStore.getState().serverRepoPath).toBeNull();
    });

    it("does not throw on error", async () => {
      mockServerStatus.mockRejectedValue(new Error("unreachable"));
      await expect(useMcpStore.getState().refreshServerStatus()).resolves.toBeUndefined();
    });
  });

  describe("clearError", () => {
    it("sets error to null", () => {
      useMcpStore.setState({ error: "something went wrong" });
      useMcpStore.getState().clearError();
      expect(useMcpStore.getState().error).toBeNull();
    });

    it("is a no-op when error is already null", () => {
      useMcpStore.setState({ error: null });
      useMcpStore.getState().clearError();
      expect(useMcpStore.getState().error).toBeNull();
    });
  });
});
