// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { FileContextMenu } from "./FileContextMenu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const openFileMock = vi.fn().mockResolvedValue(undefined);
const showInFolderMock = vi.fn().mockResolvedValue(undefined);
const writeTextMock = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as Record<string, unknown>).electronAPI = {
    shell: {
      openFile: openFileMock,
      showInFolder: showInFolderMock,
    },
  };
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  });
});

const defaultProps = {
  x: 100,
  y: 200,
  filePath: "/repo/src/main.ts",
  onClose: vi.fn(),
  onHistory: vi.fn(),
};

describe("FileContextMenu", () => {
  it("renders menu with File history option", () => {
    render(<FileContextMenu {...defaultProps} />);
    expect(screen.getByText("fileContextMenu.fileHistory")).toBeInTheDocument();
  });

  it("renders Open file option", () => {
    render(<FileContextMenu {...defaultProps} />);
    expect(screen.getByText("fileContextMenu.openFile")).toBeInTheDocument();
  });

  it("renders Show in folder option", () => {
    render(<FileContextMenu {...defaultProps} />);
    expect(screen.getByText("fileContextMenu.showInFolder")).toBeInTheDocument();
  });

  it("renders Copy path option", () => {
    render(<FileContextMenu {...defaultProps} />);
    expect(screen.getByText("fileContextMenu.copyPath")).toBeInTheDocument();
  });

  it("renders Copy file name option", () => {
    render(<FileContextMenu {...defaultProps} />);
    expect(screen.getByText("fileContextMenu.copyFileName")).toBeInTheDocument();
  });

  it("does not render Blame button when onBlame is not provided", () => {
    render(<FileContextMenu {...defaultProps} />);
    expect(screen.queryByText("fileContextMenu.blame")).not.toBeInTheDocument();
  });

  it("renders Blame button when onBlame prop is provided", () => {
    const onBlame = vi.fn();
    render(<FileContextMenu {...defaultProps} onBlame={onBlame} />);
    expect(screen.getByText("fileContextMenu.blame")).toBeInTheDocument();
  });

  it("calls onHistory and onClose when File history is clicked", () => {
    const onHistory = vi.fn();
    const onClose = vi.fn();
    render(<FileContextMenu {...defaultProps} onHistory={onHistory} onClose={onClose} />);
    fireEvent.click(screen.getByText("fileContextMenu.fileHistory"));
    expect(onHistory).toHaveBeenCalledWith("/repo/src/main.ts");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onBlame and onClose when Blame is clicked", () => {
    const onBlame = vi.fn();
    const onClose = vi.fn();
    render(<FileContextMenu {...defaultProps} onBlame={onBlame} onClose={onClose} />);
    fireEvent.click(screen.getByText("fileContextMenu.blame"));
    expect(onBlame).toHaveBeenCalledWith("/repo/src/main.ts");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls shell.openFile and onClose when Open file is clicked", () => {
    const onClose = vi.fn();
    render(<FileContextMenu {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("fileContextMenu.openFile"));
    expect(openFileMock).toHaveBeenCalledWith("/repo/src/main.ts");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls shell.showInFolder and onClose when Show in folder is clicked", () => {
    const onClose = vi.fn();
    render(<FileContextMenu {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("fileContextMenu.showInFolder"));
    expect(showInFolderMock).toHaveBeenCalledWith("/repo/src/main.ts");
    expect(onClose).toHaveBeenCalled();
  });

  it("copies full path to clipboard when Copy path is clicked", () => {
    const onClose = vi.fn();
    render(<FileContextMenu {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("fileContextMenu.copyPath"));
    expect(writeTextMock).toHaveBeenCalledWith("/repo/src/main.ts");
    expect(onClose).toHaveBeenCalled();
  });

  it("copies only file name when Copy file name is clicked", () => {
    const onClose = vi.fn();
    render(<FileContextMenu {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("fileContextMenu.copyFileName"));
    expect(writeTextMock).toHaveBeenCalledWith("main.ts");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape key press", () => {
    const onClose = vi.fn();
    render(<FileContextMenu {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on outside mousedown click", () => {
    const onClose = vi.fn();
    render(<FileContextMenu {...defaultProps} onClose={onClose} />);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it("is positioned at the given x/y coordinates", () => {
    const { container } = render(<FileContextMenu {...defaultProps} x={150} y={250} />);
    const menu = container.firstChild as HTMLElement;
    expect(menu.style.left).toBe("150px");
    expect(menu.style.top).toBe("250px");
  });
});
