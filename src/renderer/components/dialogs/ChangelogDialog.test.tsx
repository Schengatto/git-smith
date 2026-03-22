// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ChangelogDialog } from "./ChangelogDialog";

const mockElectronAPI = {
  changelog: {
    getTagsBefore: vi.fn().mockResolvedValue([]),
    generate: vi.fn().mockResolvedValue({
      from: "v1",
      to: "HEAD",
      totalCommits: 0,
      groups: [],
      authors: [],
    }),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("ChangelogDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ChangelogDialog open={false} onClose={vi.fn()} commitHash="abc1234" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(
      <ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />
    );
    expect(container.innerHTML).not.toBe("");
  });

  it("shows abbreviated commit hash in header", () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234567890" />);
    expect(screen.getByText(/abc1234/)).toBeInTheDocument();
  });

  it("shows commit subject when provided", () => {
    render(
      <ChangelogDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc1234"
        commitSubject="fix: bug"
      />
    );
    expect(screen.getByText(/fix: bug/)).toBeInTheDocument();
  });

  it("shows Close button", () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<ChangelogDialog open={true} onClose={onClose} commitHash="abc1234" />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows From label", () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    expect(screen.getByText("From")).toBeInTheDocument();
  });

  it("shows to label", () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    expect(screen.getByText("to")).toBeInTheDocument();
  });

  it("calls getTagsBefore on open", async () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(mockElectronAPI.changelog.getTagsBefore).toHaveBeenCalledWith("abc1234");
    });
  });

  it("shows custom ref option in select", async () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("Custom ref...")).toBeInTheDocument();
    });
  });

  it("shows tag options when tags are returned", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0", "v2.0.0"]);
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("v1.0.0")).toBeInTheDocument();
      expect(screen.getByText("v2.0.0")).toBeInTheDocument();
    });
  });

  it("calls generate when tag is selected", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(mockElectronAPI.changelog.generate).toHaveBeenCalledWith("v1.0.0", "abc1234");
    });
  });

  it("shows custom ref input when Custom ref is selected", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => screen.getByText("Custom ref..."));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "__custom__" } });
    expect(screen.getByPlaceholderText("branch, tag, or commit hash")).toBeInTheDocument();
  });

  it("shows Generate button when in custom ref mode", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue([]);
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("Generate")).toBeInTheDocument();
    });
  });

  it("Generate button is disabled when custom ref input is empty", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue([]);
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("Generate")).toBeDisabled();
    });
  });

  it("shows Copy as Markdown button when changelog data is available", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "v1.0.0",
      to: "abc1234",
      totalCommits: 2,
      groups: [
        {
          label: "Features",
          color: "var(--green)",
          entries: [
            {
              hash: "111",
              abbreviatedHash: "111aaaa",
              scope: "",
              description: "add thing",
            },
          ],
        },
      ],
      authors: ["Alice"],
    });
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("Copy as Markdown")).toBeInTheDocument();
    });
  });

  it("shows commit count and author count in footer", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "v1.0.0",
      to: "abc1234",
      totalCommits: 5,
      groups: [],
      authors: ["Alice", "Bob"],
    });
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("5 commits · 2 authors")).toBeInTheDocument();
    });
  });

  it("shows changelog groups and entries", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "v1.0.0",
      to: "abc1234",
      totalCommits: 1,
      groups: [
        {
          label: "Features",
          color: "var(--green)",
          entries: [
            {
              hash: "aaa",
              abbreviatedHash: "aaa1234",
              scope: "",
              description: "add button",
            },
          ],
        },
      ],
      authors: ["Alice"],
    });
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      // Group label is rendered with a leading icon character in the same div
      expect(screen.getByText(/Features/)).toBeInTheDocument();
      expect(screen.getByText("add button")).toBeInTheDocument();
    });
  });

  it("calls clipboard writeText when Copy as Markdown is clicked", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "v1.0.0",
      to: "abc1234",
      totalCommits: 1,
      groups: [],
      authors: ["Alice"],
    });
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => screen.getByText("Copy as Markdown"));
    fireEvent.click(screen.getByText("Copy as Markdown"));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it("shows 'No commits in this range' when totalCommits is 0", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "v1.0.0",
      to: "abc1234",
      totalCommits: 0,
      groups: [],
      authors: [],
    });
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("No commits in this range")).toBeInTheDocument();
    });
  });

  it("shows 'Enter a ref and click Generate' in custom mode with no input", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue([]);
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("Enter a ref and click Generate")).toBeInTheDocument();
    });
  });

  it("calls generate with custom ref when Generate button is clicked", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue([]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "myref",
      to: "abc1234",
      totalCommits: 0,
      groups: [],
      authors: [],
    });
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => screen.getByPlaceholderText("branch, tag, or commit hash"));
    fireEvent.change(screen.getByPlaceholderText("branch, tag, or commit hash"), {
      target: { value: "myref" },
    });
    fireEvent.click(screen.getByText("Generate"));
    await waitFor(() => {
      expect(mockElectronAPI.changelog.generate).toHaveBeenCalledWith("myref", "abc1234");
    });
  });

  it("shows error when changelog.generate rejects", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockRejectedValue(new Error("Range error"));
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("Range error")).toBeInTheDocument();
    });
  });

  it("falls back to custom mode when getTagsBefore rejects", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockRejectedValue(new Error("No tags"));
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("Generate")).toBeInTheDocument();
    });
  });

  it("shows Breaking Changes with warning icon prefix", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "v1.0.0",
      to: "abc1234",
      totalCommits: 1,
      groups: [
        {
          label: "Breaking Changes",
          color: "var(--red)",
          entries: [
            {
              hash: "aaa",
              abbreviatedHash: "aaa1234",
              scope: "api",
              description: "remove endpoint",
            },
          ],
        },
      ],
      authors: ["Alice"],
    });
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText(/Breaking Changes/)).toBeInTheDocument();
    });
  });

  it("shows scope prefix in bold for scoped entries", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "v1.0.0",
      to: "abc1234",
      totalCommits: 1,
      groups: [
        {
          label: "Features",
          color: "var(--green)",
          entries: [
            {
              hash: "aaa",
              abbreviatedHash: "aaa1234",
              scope: "auth",
              description: "add login",
            },
          ],
        },
      ],
      authors: ["Alice"],
    });
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("auth:")).toBeInTheDocument();
      expect(screen.getByText("add login")).toBeInTheDocument();
    });
  });

  it("generates correct markdown content when Copy as Markdown is clicked", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "v1.0.0",
      to: "abc1234",
      totalCommits: 1,
      groups: [
        {
          label: "Features",
          color: "var(--green)",
          entries: [
            {
              hash: "aaa",
              abbreviatedHash: "aaa1234",
              scope: "",
              description: "add button",
            },
          ],
        },
      ],
      authors: ["Alice"],
    });
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => screen.getByText("Copy as Markdown"));
    fireEvent.click(screen.getByText("Copy as Markdown"));
    const writtenText = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as string;
    expect(writtenText).toContain("## Changelog");
    expect(writtenText).toContain("### Features");
    expect(writtenText).toContain("add button");
    expect(writtenText).toContain("aaa1234");
  });

  it("renders in window mode without overlay wrapper", () => {
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" mode="window" />);
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("does not auto-generate when custom ref mode is active", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue([]);
    render(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => screen.getByText("Generate"));
    // generate should NOT have been called with empty customBase
    expect(mockElectronAPI.changelog.generate).not.toHaveBeenCalled();
  });

  it("resets state when dialog re-opens", async () => {
    mockElectronAPI.changelog.getTagsBefore.mockResolvedValue(["v1.0.0"]);
    mockElectronAPI.changelog.generate.mockResolvedValue({
      from: "v1.0.0",
      to: "abc1234",
      totalCommits: 0,
      groups: [],
      authors: [],
    });
    const { rerender } = render(
      <ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />
    );
    await waitFor(() => expect(mockElectronAPI.changelog.getTagsBefore).toHaveBeenCalledOnce());
    rerender(<ChangelogDialog open={false} onClose={vi.fn()} commitHash="abc1234" />);
    rerender(<ChangelogDialog open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => expect(mockElectronAPI.changelog.getTagsBefore).toHaveBeenCalledTimes(2));
  });
});
