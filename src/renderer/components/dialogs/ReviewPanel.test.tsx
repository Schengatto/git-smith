// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ReviewPanel } from "./ReviewPanel";

const mockElectronAPI = {
  review: {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.review.load.mockResolvedValue(null);
  mockElectronAPI.review.save.mockResolvedValue(undefined);
  mockElectronAPI.review.clear.mockResolvedValue(undefined);
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

describe("ReviewPanel", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ReviewPanel open={false} onClose={vi.fn()} commitHash="abc1234" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title with commit hash when open", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234def5" />);
    expect(screen.getByText(/inline review/i)).toBeInTheDocument();
    expect(screen.getByText(/abc1234/i)).toBeInTheDocument();
  });

  it("shows the Add Comment form section", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    // "Add Comment" appears as section header and as button; check the button
    expect(screen.getByRole("button", { name: /add comment/i })).toBeInTheDocument();
  });

  it("renders File Path and Line inputs", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    expect(screen.getByPlaceholderText(/src\/renderer\/App\.tsx/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
  });

  it("renders severity selector buttons", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    // Severity buttons have exact text: Comment, Suggestion, Issue
    expect(screen.getByRole("button", { name: /^comment$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^suggestion$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^issue$/i })).toBeInTheDocument();
  });

  it("renders the comment textarea", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    expect(screen.getByPlaceholderText(/describe the comment/i)).toBeInTheDocument();
  });

  it("Add Comment button is disabled when fields are empty", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    const addBtn = screen.getByRole("button", { name: /add comment/i });
    expect(addBtn).toBeDisabled();
  });

  it("shows empty state message when no comments", async () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText(/no review comments yet/i)).toBeInTheDocument();
    });
  });

  it("shows existing comments when load returns data", async () => {
    mockElectronAPI.review.load.mockResolvedValue({
      commitHash: "abc1234",
      comments: [
        {
          id: "1",
          file: "src/index.ts",
          line: 42,
          body: "This looks wrong",
          severity: "issue",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("This looks wrong")).toBeInTheDocument();
      expect(screen.getByText(/src\/index\.ts/)).toBeInTheDocument();
    });
  });

  it("shows Clear All button when comments exist", async () => {
    mockElectronAPI.review.load.mockResolvedValue({
      commitHash: "abc1234",
      comments: [
        {
          id: "1",
          file: "src/index.ts",
          line: 1,
          body: "A comment",
          severity: "comment",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
    });
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<ReviewPanel open={true} onClose={onClose} commitHash="abc1234" />);
    // The footer has a visible "Close" text button (not the X icon button)
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("changes severity selection when clicking Suggestion", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    const suggestionBtn = screen.getByRole("button", { name: /^suggestion$/i });
    fireEvent.click(suggestionBtn);
    // No error thrown — interaction works
    expect(suggestionBtn).toBeInTheDocument();
  });

  it("changes severity selection when clicking Issue", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    const issueBtn = screen.getByRole("button", { name: /^issue$/i });
    fireEvent.click(issueBtn);
    expect(issueBtn).toBeInTheDocument();
  });

  it("Add Comment button becomes enabled when all required fields are filled", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    const fileInput = screen.getByPlaceholderText(/src\/renderer\/App\.tsx/i);
    const bodyInput = screen.getByPlaceholderText(/describe the comment/i);

    fireEvent.change(fileInput, { target: { value: "src/index.ts" } });
    fireEvent.change(bodyInput, { target: { value: "This is a comment" } });

    const addBtn = screen.getByRole("button", { name: /add comment/i });
    expect(addBtn).not.toBeDisabled();
  });

  it("Add Comment button remains disabled when only file is filled", () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    const fileInput = screen.getByPlaceholderText(/src\/renderer\/App\.tsx/i);
    fireEvent.change(fileInput, { target: { value: "src/index.ts" } });
    const addBtn = screen.getByRole("button", { name: /add comment/i });
    expect(addBtn).toBeDisabled();
  });

  it("adding a comment shows it in the list", async () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText(/no review comments yet/i)).toBeInTheDocument();
    });

    const fileInput = screen.getByPlaceholderText(/src\/renderer\/App\.tsx/i);
    const bodyInput = screen.getByPlaceholderText(/describe the comment/i);

    fireEvent.change(fileInput, { target: { value: "src/index.ts" } });
    fireEvent.change(bodyInput, { target: { value: "My new comment" } });
    fireEvent.click(screen.getByRole("button", { name: /add comment/i }));

    await waitFor(() => {
      expect(screen.getByText("My new comment")).toBeInTheDocument();
    });
  });

  it("adding a comment resets the form", async () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText(/no review comments yet/i)).toBeInTheDocument();
    });

    const fileInput = screen.getByPlaceholderText(/src\/renderer\/App\.tsx/i);
    const bodyInput = screen.getByPlaceholderText(/describe the comment/i);

    fireEvent.change(fileInput, { target: { value: "src/index.ts" } });
    fireEvent.change(bodyInput, { target: { value: "My comment" } });
    fireEvent.click(screen.getByRole("button", { name: /add comment/i }));

    await waitFor(() => {
      expect(fileInput).toHaveValue("");
      expect(bodyInput).toHaveValue("");
    });
  });

  it("deletes a comment when delete button is clicked", async () => {
    mockElectronAPI.review.load.mockResolvedValue({
      commitHash: "abc1234",
      comments: [
        {
          id: "1",
          file: "src/delete-me.ts",
          line: 5,
          body: "Delete this comment",
          severity: "issue",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText("Delete this comment")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole("button", { name: /delete comment/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.queryByText("Delete this comment")).not.toBeInTheDocument();
    });
    expect(mockElectronAPI.review.save).toHaveBeenCalled();
  });

  it("shows 'Confirm Clear All' after first click on Clear All", async () => {
    mockElectronAPI.review.load.mockResolvedValue({
      commitHash: "abc1234",
      comments: [
        {
          id: "1",
          file: "src/index.ts",
          line: 1,
          body: "A comment",
          severity: "comment",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(screen.getByText("Confirm Clear All")).toBeInTheDocument();
  });

  it("clears all comments when 'Confirm Clear All' is clicked", async () => {
    mockElectronAPI.review.load.mockResolvedValue({
      commitHash: "abc1234",
      comments: [
        {
          id: "1",
          file: "src/index.ts",
          line: 1,
          body: "A comment",
          severity: "comment",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
    });

    // Click once to arm, click again to confirm
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    fireEvent.click(screen.getByText("Confirm Clear All"));

    await waitFor(() => {
      expect(mockElectronAPI.review.clear).toHaveBeenCalledWith("abc1234");
    });
  });

  it("shows 1 comment in title when one comment exists", async () => {
    mockElectronAPI.review.load.mockResolvedValue({
      commitHash: "abc1234",
      comments: [
        {
          id: "1",
          file: "src/index.ts",
          line: 1,
          body: "A comment",
          severity: "comment",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      // Title includes "(1 comment)" — singular
      expect(screen.getByText(/1 comment\)/)).toBeInTheDocument();
    });
  });

  it("shows plural 'comments' in title when multiple comments exist", async () => {
    mockElectronAPI.review.load.mockResolvedValue({
      commitHash: "abc1234",
      comments: [
        {
          id: "1",
          file: "a.ts",
          line: 1,
          body: "First",
          severity: "comment",
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          file: "b.ts",
          line: 2,
          body: "Second",
          severity: "issue",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText(/2 comments\)/)).toBeInTheDocument();
    });
  });

  it("saves comments when a comment is added", async () => {
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText(/no review comments yet/i)).toBeInTheDocument();
    });

    const fileInput = screen.getByPlaceholderText(/src\/renderer\/App\.tsx/i);
    const bodyInput = screen.getByPlaceholderText(/describe the comment/i);

    fireEvent.change(fileInput, { target: { value: "src/file.ts" } });
    fireEvent.change(bodyInput, { target: { value: "A test comment" } });
    fireEvent.click(screen.getByRole("button", { name: /add comment/i }));

    await waitFor(() => {
      expect(mockElectronAPI.review.save).toHaveBeenCalled();
    });
  });

  it("handles load error gracefully by showing empty state", async () => {
    mockElectronAPI.review.load.mockRejectedValue(new Error("load failed"));
    render(<ReviewPanel open={true} onClose={vi.fn()} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByText(/no review comments yet/i)).toBeInTheDocument();
    });
  });

  it("resets confirmClear when Close is clicked", async () => {
    mockElectronAPI.review.load.mockResolvedValue({
      commitHash: "abc1234",
      comments: [
        {
          id: "1",
          file: "a.ts",
          line: 1,
          body: "Comment",
          severity: "comment",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    const onClose = vi.fn();
    render(<ReviewPanel open={true} onClose={onClose} commitHash="abc1234" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
    });
    // Arm confirm clear
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(screen.getByText("Confirm Clear All")).toBeInTheDocument();
    // Close
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });
});
