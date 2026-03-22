// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CreateTagDialog } from "./TagDialog";

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    loadGraph: vi.fn().mockResolvedValue(undefined),
  }),
}));

const mockElectronAPI = {
  tag: {
    create: vi.fn().mockResolvedValue(undefined),
    push: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("CreateTagDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <CreateTagDialog
        open={false}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    // "Create Tag" appears as modal title and as button; verify at least one is present
    expect(screen.getAllByText("Create Tag").length).toBeGreaterThan(0);
  });

  it("shows the commit hash (first 10 chars) and subject", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText("abc123def4")).toBeInTheDocument();
    expect(screen.getByText("fix: something")).toBeInTheDocument();
  });

  it("shows the Tag name input with placeholder", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByPlaceholderText("v1.0.0")).toBeInTheDocument();
  });

  it("shows Annotated tag label", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    // DialogCheckbox renders a custom div, not a real input[type=checkbox]
    expect(screen.getByText(/annotated tag/i)).toBeInTheDocument();
  });

  it("shows Push tag to remote label", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByText(/push tag to remote/i)).toBeInTheDocument();
  });

  it("shows Message textarea when annotated is enabled by default", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    // annotated defaults to true, so the Message section is visible
    expect(screen.getByText("Message")).toBeInTheDocument();
  });

  it("hides Message textarea when annotated is toggled off", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    // DialogCheckbox renders: <label><div onClick=toggle /><text /></label>
    // The div is the first child of the label; find the label element and click its first child
    const annotatedLabel = screen.getByText(/annotated tag/i).closest("label");
    const checkboxDiv = annotatedLabel?.querySelector("div");
    expect(checkboxDiv).not.toBeNull();
    fireEvent.click(checkboxDiv!);
    expect(screen.queryByText("Message")).not.toBeInTheDocument();
  });

  it("Create Tag button is disabled when tag name is empty", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    expect(screen.getByRole("button", { name: /create tag/i })).toBeDisabled();
  });

  it("Create Tag button becomes enabled when tag name is typed", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.change(screen.getByPlaceholderText("v1.0.0"), {
      target: { value: "v1.0.0" },
    });
    expect(screen.getByRole("button", { name: /create tag/i })).not.toBeDisabled();
  });

  it("shows Create & Push label when pushToRemote is toggled on", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    // First enter a tag name so the confirm button is not disabled
    fireEvent.change(screen.getByPlaceholderText("v1.0.0"), {
      target: { value: "v1.0.0" },
    });
    // DialogCheckbox: click the inner div of the pushToRemote label
    const pushLabel = screen.getByText(/push tag to remote/i).closest("label");
    const checkboxDiv = pushLabel?.querySelector("div");
    expect(checkboxDiv).not.toBeNull();
    fireEvent.click(checkboxDiv!);
    expect(screen.getByRole("button", { name: /create & push/i })).toBeInTheDocument();
  });

  it("calls tag.create when confirm button is clicked with a name", () => {
    render(
      <CreateTagDialog
        open={true}
        onClose={vi.fn()}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.change(screen.getByPlaceholderText("v1.0.0"), {
      target: { value: "v1.0.0" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create tag/i }));
    expect(mockElectronAPI.tag.create).toHaveBeenCalledWith(
      "v1.0.0",
      "abc123def456",
      expect.any(String)
    );
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <CreateTagDialog
        open={true}
        onClose={onClose}
        commitHash="abc123def456"
        commitSubject="fix: something"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
