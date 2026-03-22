// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { AddSubmoduleDialog } from "./AddSubmoduleDialog";

const mockElectronAPI = {
  submodule: {
    add: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

describe("AddSubmoduleDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<AddSubmoduleDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<AddSubmoduleDialog open={true} onClose={vi.fn()} />);
    // "Add Submodule" appears as modal title and as confirm button
    expect(screen.getAllByText("Add Submodule").length).toBeGreaterThan(0);
  });

  it("shows Repository URL input with placeholder", () => {
    render(<AddSubmoduleDialog open={true} onClose={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("https://github.com/user/repo.git")
    ).toBeInTheDocument();
  });

  it("shows Path input with placeholder", () => {
    render(<AddSubmoduleDialog open={true} onClose={vi.fn()} />);
    expect(
      screen.getByPlaceholderText(/leave empty to use repo name/i)
    ).toBeInTheDocument();
  });

  it("Add Submodule confirm button is disabled when URL is empty", () => {
    render(<AddSubmoduleDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /add submodule/i })).toBeDisabled();
  });

  it("Add Submodule button becomes enabled when URL is entered", () => {
    render(<AddSubmoduleDialog open={true} onClose={vi.fn()} />);
    const urlInput = screen.getByPlaceholderText("https://github.com/user/repo.git");
    fireEvent.change(urlInput, {
      target: { value: "https://github.com/example/lib.git" },
    });
    expect(screen.getByRole("button", { name: /add submodule/i })).not.toBeDisabled();
  });

  it("calls submodule.add with URL when confirmed without path", () => {
    render(<AddSubmoduleDialog open={true} onClose={vi.fn()} />);
    const urlInput = screen.getByPlaceholderText("https://github.com/user/repo.git");
    fireEvent.change(urlInput, {
      target: { value: "https://github.com/example/lib.git" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add submodule/i }));
    expect(mockElectronAPI.submodule.add).toHaveBeenCalledWith(
      "https://github.com/example/lib.git",
      undefined
    );
  });

  it("calls submodule.add with URL and path when both are provided", () => {
    render(<AddSubmoduleDialog open={true} onClose={vi.fn()} />);
    const urlInput = screen.getByPlaceholderText("https://github.com/user/repo.git");
    const pathInput = screen.getByPlaceholderText(/leave empty to use repo name/i);
    fireEvent.change(urlInput, {
      target: { value: "https://github.com/example/lib.git" },
    });
    fireEvent.change(pathInput, { target: { value: "libs/example" } });
    fireEvent.click(screen.getByRole("button", { name: /add submodule/i }));
    expect(mockElectronAPI.submodule.add).toHaveBeenCalledWith(
      "https://github.com/example/lib.git",
      "libs/example"
    );
  });

  it("shows error when submodule.add fails", async () => {
    mockElectronAPI.submodule.add.mockRejectedValue(
      new Error("Failed to clone repository")
    );
    render(<AddSubmoduleDialog open={true} onClose={vi.fn()} />);
    const urlInput = screen.getByPlaceholderText("https://github.com/user/repo.git");
    fireEvent.change(urlInput, {
      target: { value: "https://github.com/example/lib.git" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add submodule/i }));
    const { waitFor } = await import("@testing-library/react");
    await waitFor(() => {
      expect(screen.getByText("Failed to clone repository")).toBeInTheDocument();
    });
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(<AddSubmoduleDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("triggers add when Enter is pressed in path input", () => {
    render(<AddSubmoduleDialog open={true} onClose={vi.fn()} />);
    const urlInput = screen.getByPlaceholderText("https://github.com/user/repo.git");
    const pathInput = screen.getByPlaceholderText(/leave empty to use repo name/i);
    fireEvent.change(urlInput, {
      target: { value: "https://github.com/example/lib.git" },
    });
    fireEvent.keyDown(pathInput, { key: "Enter" });
    expect(mockElectronAPI.submodule.add).toHaveBeenCalled();
  });
});
