// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MergeEditorDialog } from "./MergeEditorDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

const mockVersions = {
  base: "base content",
  ours: "our content",
  theirs: "their content",
};

const mockElectronAPI = {
  conflict: {
    fileContent: vi.fn().mockResolvedValue(mockVersions),
    saveMerged: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.conflict.fileContent.mockResolvedValue(mockVersions);
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("MergeEditorDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <MergeEditorDialog open={false} onClose={vi.fn()} filePath="src/foo.ts" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog title with filename when open", () => {
    render(<MergeEditorDialog open={true} onClose={vi.fn()} filePath="src/foo.ts" />);
    expect(screen.getByText(/mergeEditor.threeWayTitle/)).toBeInTheDocument();
    expect(screen.getByText(/foo\.ts/)).toBeInTheDocument();
  });

  it("calls conflict.fileContent on open", () => {
    render(<MergeEditorDialog open={true} onClose={vi.fn()} filePath="src/foo.ts" />);
    expect(mockElectronAPI.conflict.fileContent).toHaveBeenCalledWith("src/foo.ts");
  });

  it("renders Quick resolve buttons after loading", async () => {
    render(<MergeEditorDialog open={true} onClose={vi.fn()} filePath="src/foo.ts" />);
    await vi.waitFor(() => {
      expect(screen.getByText("mergeEditor.acceptOurs")).toBeInTheDocument();
      expect(screen.getByText("mergeEditor.acceptTheirs")).toBeInTheDocument();
      expect(screen.getByText("mergeEditor.acceptBoth")).toBeInTheDocument();
    });
  });

  it("renders Save & Mark Resolved button", async () => {
    render(<MergeEditorDialog open={true} onClose={vi.fn()} filePath="src/foo.ts" />);
    await vi.waitFor(() => {
      expect(screen.getByText("mergeEditor.saveAndMarkResolved")).toBeInTheDocument();
    });
  });

  it("renders panel labels after loading", async () => {
    render(<MergeEditorDialog open={true} onClose={vi.fn()} filePath="src/foo.ts" />);
    await vi.waitFor(() => {
      expect(screen.getByText(/mergeEditor.oursBranch/)).toBeInTheDocument();
      expect(screen.getByText(/mergeEditor.baseAncestor/)).toBeInTheDocument();
      expect(screen.getByText(/mergeEditor.theirsIncoming/)).toBeInTheDocument();
      expect(screen.getByText(/mergeEditor.resultEditable/)).toBeInTheDocument();
    });
  });

  it("Accept Ours sets result textarea to ours content", async () => {
    render(<MergeEditorDialog open={true} onClose={vi.fn()} filePath="src/foo.ts" />);
    // Wait until the 3-panel source view is visible (versions loaded)
    await vi.waitFor(() => screen.getByText(/mergeEditor.oursBranch/));
    fireEvent.click(screen.getByText("mergeEditor.acceptOurs"));
    await vi.waitFor(() => {
      const textareas = document.querySelectorAll("textarea");
      const resultTextarea = textareas[textareas.length - 1] as HTMLTextAreaElement;
      expect(resultTextarea.value).toContain("our content");
    });
  });

  it("Accept Theirs sets result textarea to theirs content", async () => {
    render(<MergeEditorDialog open={true} onClose={vi.fn()} filePath="src/foo.ts" />);
    await vi.waitFor(() => screen.getByText(/mergeEditor.oursBranch/));
    fireEvent.click(screen.getByText("mergeEditor.acceptTheirs"));
    await vi.waitFor(() => {
      const textareas = document.querySelectorAll("textarea");
      const resultTextarea = textareas[textareas.length - 1] as HTMLTextAreaElement;
      expect(resultTextarea.value).toContain("their content");
    });
  });

  it("Accept Both concatenates ours and theirs in the result", async () => {
    render(<MergeEditorDialog open={true} onClose={vi.fn()} filePath="src/foo.ts" />);
    await vi.waitFor(() => screen.getByText(/mergeEditor.oursBranch/));
    fireEvent.click(screen.getByText("mergeEditor.acceptBoth"));
    await vi.waitFor(() => {
      const textareas = document.querySelectorAll("textarea");
      const resultTextarea = textareas[textareas.length - 1] as HTMLTextAreaElement;
      expect(resultTextarea.value).toContain("our content");
      expect(resultTextarea.value).toContain("their content");
    });
  });

  it("calls conflict.saveMerged when Save & Mark Resolved is clicked", async () => {
    const onClose = vi.fn();
    render(<MergeEditorDialog open={true} onClose={onClose} filePath="src/foo.ts" />);
    // Wait until versions have loaded (button becomes enabled)
    await vi.waitFor(() => {
      const btn = screen.getByText("mergeEditor.saveAndMarkResolved") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
    fireEvent.click(screen.getByText("mergeEditor.saveAndMarkResolved"));
    await vi.waitFor(() => {
      expect(mockElectronAPI.conflict.saveMerged).toHaveBeenCalledWith(
        "src/foo.ts",
        expect.any(String)
      );
    });
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    render(<MergeEditorDialog open={true} onClose={onClose} filePath="src/foo.ts" />);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows error message when fileContent rejects", async () => {
    mockElectronAPI.conflict.fileContent.mockRejectedValueOnce(new Error("file not found"));
    render(<MergeEditorDialog open={true} onClose={vi.fn()} filePath="src/missing.ts" />);
    await vi.waitFor(() => {
      expect(screen.getByText("file not found")).toBeInTheDocument();
    });
  });
});
