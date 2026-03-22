// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { SearchCommitsDialog } from "./SearchCommitsDialog";

const mockSelectCommit = vi.fn();

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    selectCommit: mockSelectCommit,
  }),
}));

const mockElectronAPI = {
  log: {
    search: vi.fn().mockResolvedValue([]),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

describe("SearchCommitsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SearchCommitsDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Search Commits")).toBeInTheDocument();
  });

  it("shows Message contains input", () => {
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/fix, feat, refactor/i)).toBeInTheDocument();
  });

  it("shows Author input", () => {
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/name or email/i)).toBeInTheDocument();
  });

  it("shows Code change contains input", () => {
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/functionName, variable/i)).toBeInTheDocument();
  });

  it("Search button is disabled when all inputs are empty", () => {
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^search$/i })).toBeDisabled();
  });

  it("Search button becomes enabled when grep input has text", () => {
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    const grepInput = screen.getByPlaceholderText(/fix, feat, refactor/i);
    fireEvent.change(grepInput, { target: { value: "fix" } });
    expect(screen.getByRole("button", { name: /^search$/i })).not.toBeDisabled();
  });

  it("calls log.search when Search button is clicked", () => {
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    const grepInput = screen.getByPlaceholderText(/fix, feat, refactor/i);
    fireEvent.change(grepInput, { target: { value: "fix" } });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    expect(mockElectronAPI.log.search).toHaveBeenCalledWith(
      expect.objectContaining({ grep: "fix", maxCount: 200 })
    );
  });

  it("shows result count after searching", async () => {
    mockElectronAPI.log.search.mockResolvedValue([]);
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    const grepInput = screen.getByPlaceholderText(/fix, feat, refactor/i);
    fireEvent.change(grepInput, { target: { value: "fix" } });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText(/0 results found/i)).toBeInTheDocument();
    });
  });

  it("renders search results when commits are returned", async () => {
    mockElectronAPI.log.search.mockResolvedValue([
      {
        hash: "abc123",
        abbreviatedHash: "abc123",
        subject: "fix: correct the bug",
        authorName: "Dev User",
        authorDate: new Date("2024-01-01").toISOString(),
      },
    ]);
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    const grepInput = screen.getByPlaceholderText(/fix, feat, refactor/i);
    fireEvent.change(grepInput, { target: { value: "fix" } });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => {
      expect(screen.getByText("fix: correct the bug")).toBeInTheDocument();
      expect(screen.getByText("Dev User")).toBeInTheDocument();
    });
  });

  it("calls selectCommit and onClose when a result row is clicked", async () => {
    mockElectronAPI.log.search.mockResolvedValue([
      {
        hash: "abc123",
        abbreviatedHash: "abc123",
        subject: "fix: correct the bug",
        authorName: "Dev User",
        authorDate: new Date("2024-01-01").toISOString(),
      },
    ]);
    const onClose = vi.fn();
    render(<SearchCommitsDialog open={true} onClose={onClose} />);
    const grepInput = screen.getByPlaceholderText(/fix, feat, refactor/i);
    fireEvent.change(grepInput, { target: { value: "fix" } });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => screen.getByText("fix: correct the bug"));
    fireEvent.click(screen.getByText("fix: correct the bug"));
    expect(mockSelectCommit).toHaveBeenCalledWith("abc123");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<SearchCommitsDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("triggers search when Enter is pressed in grep input", () => {
    render(<SearchCommitsDialog open={true} onClose={vi.fn()} />);
    const grepInput = screen.getByPlaceholderText(/fix, feat, refactor/i);
    fireEvent.change(grepInput, { target: { value: "feat" } });
    fireEvent.keyDown(grepInput, { key: "Enter" });
    expect(mockElectronAPI.log.search).toHaveBeenCalled();
  });
});
