// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { GitOperationLogDialog } from "./GitOperationLogDialog";

const storeState = {
  open: false,
  label: "Test operation",
  entries: [] as {
    id: string;
    command: string;
    args: string[];
    exitCode?: number;
    duration?: number;
    error?: string;
  }[],
  outputLines: [] as { entryId: string; text: string; stream: "stdout" | "stderr" }[],
  running: false,
  error: null as string | null,
  autoClose: false,
  close: vi.fn(),
  cancel: vi.fn(),
  setAutoClose: vi.fn(),
};

vi.mock("../../store/git-operation-store", () => ({
  useGitOperationStore: () => storeState,
  runGitOperation: vi.fn(),
  GitOperationCancelledError: class extends Error {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  storeState.open = false;
  storeState.running = false;
  storeState.error = null;
  storeState.entries = [];
  storeState.outputLines = [];
  storeState.label = "Test operation";
  storeState.autoClose = false;
});

describe("GitOperationLogDialog", () => {
  it("renders nothing when store open=false", () => {
    storeState.open = false;
    const { container } = render(<GitOperationLogDialog />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when store open=true", () => {
    storeState.open = true;
    const { container } = render(<GitOperationLogDialog />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows the operation label in header", () => {
    storeState.open = true;
    storeState.label = "Git Push";
    render(<GitOperationLogDialog />);
    expect(screen.getByText(/git push/i)).toBeInTheDocument();
  });

  it("shows Running status when running=true", () => {
    storeState.open = true;
    storeState.running = true;
    render(<GitOperationLogDialog />);
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });

  it("shows Done status when not running and no error", () => {
    storeState.open = true;
    storeState.running = false;
    storeState.error = null;
    render(<GitOperationLogDialog />);
    expect(screen.getByText(/done/i)).toBeInTheDocument();
  });

  it("shows Failed status when there is an error", () => {
    storeState.open = true;
    storeState.label = "Git Push";
    storeState.error = "Push failed: rejected";
    render(<GitOperationLogDialog />);
    // The header span contains "Git Push — Failed"
    expect(screen.getByText(/git push — failed/i)).toBeInTheDocument();
  });

  it("shows error message content when error is set", () => {
    storeState.open = true;
    storeState.error = "Push failed: rejected";
    render(<GitOperationLogDialog />);
    expect(screen.getByText("Push failed: rejected")).toBeInTheDocument();
  });

  it("shows Cancel button when running", () => {
    storeState.open = true;
    storeState.running = true;
    render(<GitOperationLogDialog />);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("shows Close button when not running", () => {
    storeState.open = true;
    storeState.running = false;
    render(<GitOperationLogDialog />);
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("calls close when Close button is clicked", () => {
    storeState.open = true;
    storeState.running = false;
    render(<GitOperationLogDialog />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(storeState.close).toHaveBeenCalledOnce();
  });

  it("calls cancel when Cancel button is clicked during running", () => {
    storeState.open = true;
    storeState.running = true;
    render(<GitOperationLogDialog />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(storeState.cancel).toHaveBeenCalledOnce();
  });

  it("shows Close on success checkbox", () => {
    storeState.open = true;
    render(<GitOperationLogDialog />);
    expect(screen.getByText(/close on success/i)).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("autoClose checkbox reflects the store state", () => {
    storeState.open = true;
    storeState.autoClose = true;
    render(<GitOperationLogDialog />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls setAutoClose when checkbox is toggled", () => {
    storeState.open = true;
    storeState.autoClose = false;
    render(<GitOperationLogDialog />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(storeState.setAutoClose).toHaveBeenCalledWith(true);
  });

  it("shows Waiting for git output when running with no entries", () => {
    storeState.open = true;
    storeState.running = true;
    storeState.entries = [];
    render(<GitOperationLogDialog />);
    expect(screen.getByText(/waiting for git output/i)).toBeInTheDocument();
  });

  it("renders log entries with command and args", () => {
    storeState.open = true;
    storeState.entries = [
      {
        id: "1",
        command: "git",
        args: ["push", "origin", "main"],
        exitCode: 0,
        duration: 234,
      },
    ];
    const { container } = render(<GitOperationLogDialog />);
    // Command and args are in a span rendered as "git push origin main"
    expect(container.textContent).toContain("git");
    expect(container.textContent).toContain("push origin main");
  });
});
