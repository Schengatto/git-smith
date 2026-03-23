// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        "ai.aiReviewTitle": "AI Code Review — {{hash}}",
        "ai.analyzingCommit": "Analyzing commit...",
        "ai.close": "Close",
      };
      let result = translations[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(`{{${k}}}`, v);
        });
      }
      return result;
    },
    i18n: { language: "en" },
  }),
}));

import { AiReviewDialog } from "./AiReviewDialog";

const reviewCommitMock = vi.fn();

vi.mock("../../store/mcp-store", () => ({
  useMcpStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      generating: false,
      reviewCommit: reviewCommitMock,
    };
    return selector ? selector(state as Record<string, unknown>) : state;
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AiReviewDialog", () => {
  it("renders dialog with abbreviated hash in title", async () => {
    reviewCommitMock.mockResolvedValue("Looks good!");
    render(<AiReviewDialog hash="abcdef1234567890" onClose={vi.fn()} />);
    expect(screen.getByText(/AI Code Review — abcdef12/)).toBeInTheDocument();
  });

  it("calls reviewCommit with the provided hash on mount", async () => {
    reviewCommitMock.mockResolvedValue("All good");
    render(<AiReviewDialog hash="abc123" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(reviewCommitMock).toHaveBeenCalledWith("abc123");
    });
  });

  it("displays the review result when resolved", async () => {
    reviewCommitMock.mockResolvedValue("This commit looks well structured.");
    render(<AiReviewDialog hash="abc123" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("This commit looks well structured.")).toBeInTheDocument();
    });
  });

  it("displays error message when reviewCommit rejects", async () => {
    reviewCommitMock.mockRejectedValue(new Error("MCP not connected"));
    render(<AiReviewDialog hash="abc123" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("MCP not connected")).toBeInTheDocument();
    });
  });

  it("calls onClose when Close button in footer is clicked", async () => {
    reviewCommitMock.mockResolvedValue("Done");
    const onClose = vi.fn();
    render(<AiReviewDialog hash="abc123" onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when X button in header is clicked", async () => {
    reviewCommitMock.mockResolvedValue("Done");
    const onClose = vi.fn();
    render(<AiReviewDialog hash="abc123" onClose={onClose} />);
    fireEvent.click(screen.getByText("×"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking the backdrop", async () => {
    reviewCommitMock.mockResolvedValue("Done");
    const onClose = vi.fn();
    const { container } = render(<AiReviewDialog hash="abc123" onClose={onClose} />);
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows 'Analyzing commit...' when generating is true and review is not ready", async () => {
    const { useMcpStore } = await import("../../store/mcp-store");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(useMcpStore) as any).mockImplementation(
      (selector?: (s: Record<string, unknown>) => unknown) => {
        const state = { generating: true, reviewCommit: reviewCommitMock };
        return selector ? selector(state as Record<string, unknown>) : state;
      }
    );
    reviewCommitMock.mockReturnValue(new Promise(() => {})); // never resolves
    render(<AiReviewDialog hash="abc123" onClose={vi.fn()} />);
    expect(screen.getByText("Analyzing commit...")).toBeInTheDocument();
  });

  it("does not call onClose when clicking inside the dialog", async () => {
    reviewCommitMock.mockResolvedValue("Done");
    const onClose = vi.fn();
    render(<AiReviewDialog hash="abc123" onClose={onClose} />);
    // Click Close button (inside dialog, not backdrop)
    fireEvent.click(screen.getByText("Close"));
    // onClose called exactly once from the button, not the backdrop
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("handles non-Error rejection gracefully", async () => {
    reviewCommitMock.mockRejectedValue("string error");
    render(<AiReviewDialog hash="abc123" onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("string error")).toBeInTheDocument();
    });
  });
});
