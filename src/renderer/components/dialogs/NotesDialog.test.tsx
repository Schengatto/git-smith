// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { NotesDialog } from "./NotesDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "notes.title": "Git Notes",
        "notes.noteFor": "Note for",
        "notes.placeholder": "Add a note to this commit...",
        "notes.removeNote": "Remove Note",
        "dialogs.loading": "Loading...",
        "dialogs.cancel": "Cancel",
        "dialogs.save": "Save",
      };
      return translations[key] || key;
    },
  }),
}));

const mockGetNote = vi.fn();
const mockAddNote = vi.fn();
const mockRemoveNote = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    notes: {
      get: mockGetNote,
      add: mockAddNote,
      remove: mockRemoveNote,
    },
  };
});

describe("NotesDialog", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    hash: "abc123full",
    subject: "feat: test commit",
  };

  it("loads existing note when opened", async () => {
    mockGetNote.mockResolvedValueOnce("Existing note text");
    render(<NotesDialog {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetNote).toHaveBeenCalledWith("abc123full");
    });

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Existing note text");
  });

  it("shows commit info in header", async () => {
    mockGetNote.mockResolvedValueOnce("");
    render(<NotesDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("abc123f")).toBeInTheDocument();
    });
    expect(screen.getByText("feat: test commit")).toBeInTheDocument();
  });

  it("saves note on Save click", async () => {
    mockGetNote.mockResolvedValueOnce("");
    mockAddNote.mockResolvedValueOnce(undefined);

    render(<NotesDialog {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetNote).toHaveBeenCalled();
    });

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "New note" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockAddNote).toHaveBeenCalledWith("abc123full", "New note");
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("shows Remove Note button when note exists", async () => {
    mockGetNote.mockResolvedValueOnce("Existing");
    render(<NotesDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Remove Note")).toBeInTheDocument();
    });
  });

  it("removes note on Remove Note click", async () => {
    mockGetNote.mockResolvedValueOnce("Existing");
    mockRemoveNote.mockResolvedValueOnce(undefined);

    render(<NotesDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Remove Note")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Remove Note"));

    await waitFor(() => {
      expect(mockRemoveNote).toHaveBeenCalledWith("abc123full");
    });
  });
});
