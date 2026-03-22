// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GrepDialog } from "./GrepDialog";

const mockElectronAPI = {
  grep: {
    search: vi.fn().mockResolvedValue({ matches: [], totalCount: 0 }),
  },
  shell: {
    openFile: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.grep.search.mockResolvedValue({ matches: [], totalCount: 0 });
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

describe("GrepDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<GrepDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Git Grep / Code Search")).toBeInTheDocument();
  });

  it("renders the search input", () => {
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("Search pattern...")).toBeInTheDocument();
  });

  it("renders the Search button", () => {
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("renders option checkboxes", () => {
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Case insensitive")).toBeInTheDocument();
    expect(screen.getByText("Regex")).toBeInTheDocument();
    expect(screen.getByText("Whole word")).toBeInTheDocument();
  });

  it("renders Close button", () => {
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("Search button is disabled when pattern is empty", () => {
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    expect((screen.getByText("Search") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Search button is enabled after typing a pattern", () => {
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search pattern..."), {
      target: { value: "foo" },
    });
    expect((screen.getByText("Search") as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls grep.search with pattern and options when Search is clicked", () => {
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search pattern..."), {
      target: { value: "myFunc" },
    });
    fireEvent.click(screen.getByText("Search"));
    expect(mockElectronAPI.grep.search).toHaveBeenCalledWith(
      "myFunc",
      expect.objectContaining({ ignoreCase: false, regex: false, wholeWord: false })
    );
  });

  it("calls grep.search on Enter key press in the input", () => {
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText("Search pattern...");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockElectronAPI.grep.search).toHaveBeenCalledOnce();
  });

  it("calls onClose when Close is clicked", () => {
    const onClose = vi.fn();
    render(<GrepDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows empty-state message when search returns no results", async () => {
    mockElectronAPI.grep.search.mockResolvedValueOnce({ matches: [], totalCount: 0 });
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search pattern..."), {
      target: { value: "noresult" },
    });
    fireEvent.click(screen.getByText("Search"));
    await vi.waitFor(() => {
      expect(screen.getByText(/No matches found/)).toBeInTheDocument();
    });
  });

  it("shows match count after search returns results", async () => {
    mockElectronAPI.grep.search.mockResolvedValueOnce({
      matches: [
        { file: "src/foo.ts", line: 10, text: "const foo = 1;" },
        { file: "src/bar.ts", line: 5, text: "import foo from" },
      ],
      totalCount: 2,
    });
    render(<GrepDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Search pattern..."), {
      target: { value: "foo" },
    });
    fireEvent.click(screen.getByText("Search"));
    await vi.waitFor(() => {
      expect(screen.getByText(/2 matches in 2 files/)).toBeInTheDocument();
    });
  });
});
