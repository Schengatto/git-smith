// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { AboutDialog } from "./AboutDialog";

// Mock electronAPI
const openExternalMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: { repo: { openExternal: typeof openExternalMock } } }).electronAPI = {
    repo: { openExternal: openExternalMock },
  };
});

describe("AboutDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<AboutDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows app name and description when open", () => {
    render(<AboutDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Git Expansion")).toBeInTheDocument();
    expect(
      screen.getByText("A cross-platform Git GUI desktop application inspired by Git Extensions.")
    ).toBeInTheDocument();
  });

  it("displays version from __APP_VERSION__", () => {
    render(<AboutDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("0.0.0-test")).toBeInTheDocument();
  });

  it("displays MIT license", () => {
    render(<AboutDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("MIT")).toBeInTheDocument();
  });

  it("displays author name as a link", () => {
    render(<AboutDialog open={true} onClose={vi.fn()} />);
    const authorLink = screen.getByText("Enrico Schintu");
    expect(authorLink).toBeInTheDocument();
  });

  it("opens author website on click", () => {
    render(<AboutDialog open={true} onClose={vi.fn()} />);
    const authorLink = screen.getByText("Enrico Schintu");
    fireEvent.click(authorLink);
    expect(openExternalMock).toHaveBeenCalledWith("https://enrico.schintu.com");
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<AboutDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalled();
  });
});
