// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GistDialog } from "./GistDialog";

const mockElectronAPI = {
  gist: {
    create: vi.fn().mockResolvedValue({ url: "https://gist.github.com/abc123" }),
  },
  repo: {
    openExternal: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.gist.create.mockResolvedValue({
    url: "https://gist.github.com/abc123",
  });
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

describe("GistDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<GistDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<GistDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Create Gist / Snippet")).toBeInTheDocument();
  });

  it("renders filename, description and content fields", () => {
    render(<GistDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("snippet.txt")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Optional description...")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Paste or type your snippet here...")
    ).toBeInTheDocument();
  });

  it("renders Create Gist and Cancel buttons", () => {
    render(<GistDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Create Gist")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders visibility toggle buttons", () => {
    render(<GistDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Secret")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("prefills initialContent and initialFilename", () => {
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="hello world"
        initialFilename="hello.txt"
      />
    );
    expect((screen.getByPlaceholderText("snippet.txt") as HTMLInputElement).value).toBe(
      "hello.txt"
    );
    expect(
      (
        screen.getByPlaceholderText(
          "Paste or type your snippet here..."
        ) as HTMLTextAreaElement
      ).value
    ).toBe("hello world");
  });

  it("Create Gist button is disabled when content is empty", () => {
    render(<GistDialog open={true} onClose={vi.fn()} />);
    expect((screen.getByText("Create Gist") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Create Gist button is enabled when filename and content are filled", () => {
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="some code"
        initialFilename="file.ts"
      />
    );
    expect((screen.getByText("Create Gist") as HTMLButtonElement).disabled).toBe(false);
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<GistDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the X button is clicked", () => {
    const onClose = vi.fn();
    render(<GistDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls gist.create with correct options when Create Gist is clicked", () => {
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="console.log('hi')"
        initialFilename="index.js"
      />
    );
    fireEvent.click(screen.getByText("Create Gist"));
    expect(mockElectronAPI.gist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "index.js",
        content: "console.log('hi')",
        public: false,
      })
    );
  });

  it("switching to Public sets public: true in create options", () => {
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="code"
        initialFilename="f.ts"
      />
    );
    fireEvent.click(screen.getByText("Public"));
    fireEvent.click(screen.getByText("Create Gist"));
    expect(mockElectronAPI.gist.create).toHaveBeenCalledWith(
      expect.objectContaining({ public: true })
    );
  });

  it("shows success state with gist URL after creation", async () => {
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="hello"
        initialFilename="f.txt"
      />
    );
    fireEvent.click(screen.getByText("Create Gist"));
    await waitFor(() => {
      expect(screen.getByText("Gist created successfully!")).toBeInTheDocument();
    });
    expect(screen.getByText("https://gist.github.com/abc123")).toBeInTheDocument();
  });

  it("shows Open in Browser button after creation", async () => {
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="hello"
        initialFilename="f.txt"
      />
    );
    fireEvent.click(screen.getByText("Create Gist"));
    await waitFor(() => {
      expect(screen.getByText("Open in Browser")).toBeInTheDocument();
    });
  });

  it("calls openExternal when Open in Browser is clicked", async () => {
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="hello"
        initialFilename="f.txt"
      />
    );
    fireEvent.click(screen.getByText("Create Gist"));
    await waitFor(() => screen.getByText("Open in Browser"));
    fireEvent.click(screen.getByText("Open in Browser"));
    expect(mockElectronAPI.repo.openExternal).toHaveBeenCalledWith(
      "https://gist.github.com/abc123"
    );
  });

  it("shows error message when gist creation fails", async () => {
    mockElectronAPI.gist.create.mockRejectedValue(new Error("GitHub API error"));
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="hello"
        initialFilename="f.txt"
      />
    );
    fireEvent.click(screen.getByText("Create Gist"));
    await waitFor(() => {
      expect(screen.getByText("GitHub API error")).toBeInTheDocument();
    });
  });

  it("copies URL to clipboard when copy button is clicked after creation", async () => {
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="hello"
        initialFilename="f.txt"
      />
    );
    fireEvent.click(screen.getByText("Create Gist"));
    await waitFor(() => screen.getByText("Gist created successfully!"));
    fireEvent.click(screen.getByTitle("Copy URL"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://gist.github.com/abc123"
    );
  });

  it("shows 'Secret' visibility description by default", () => {
    render(<GistDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/Only people with the URL can view/)).toBeInTheDocument();
  });

  it("shows 'Public' visibility description when Public is selected", () => {
    render(<GistDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Public"));
    expect(screen.getByText(/Anyone can discover and view/)).toBeInTheDocument();
  });

  it("resets state when dialog re-opens", async () => {
    const { rerender } = render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="code"
        initialFilename="f.ts"
      />
    );
    // Trigger creation to reach success state
    fireEvent.click(screen.getByText("Create Gist"));
    await waitFor(() => {
      expect(screen.getByText("Gist created successfully!")).toBeInTheDocument();
    });
    // Close then re-open the dialog — success state should be cleared
    rerender(
      <GistDialog
        open={false}
        onClose={vi.fn()}
        initialContent="code"
        initialFilename="f.ts"
      />
    );
    rerender(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="code"
        initialFilename="f.ts"
      />
    );
    await waitFor(() => {
      expect(screen.getByText("Create Gist")).toBeInTheDocument();
    });
    expect(screen.queryByText("Gist created successfully!")).not.toBeInTheDocument();
  });

  it("shows 'Creating...' label on button while loading", async () => {
    mockElectronAPI.gist.create.mockReturnValue(new Promise(() => {}));
    render(
      <GistDialog
        open={true}
        onClose={vi.fn()}
        initialContent="hello"
        initialFilename="f.txt"
      />
    );
    fireEvent.click(screen.getByText("Create Gist"));
    await waitFor(() => {
      expect(screen.getByText("Creating...")).toBeInTheDocument();
    });
  });
});
