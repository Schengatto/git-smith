// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PatchCreateDialog, PatchApplyDialog } from "./PatchDialog";

vi.mock("../../store/repo-store", () => ({
  useRepoStore: Object.assign(
    () => ({ refreshStatus: vi.fn().mockResolvedValue(undefined) }),
    { getState: () => ({}), subscribe: () => () => {} }
  ),
}));

vi.mock("../../store/git-operation-store", () => ({
  runGitOperation: vi
    .fn()
    .mockImplementation((_label: string, fn: () => Promise<unknown>) => fn()),
  GitOperationCancelledError: class extends Error {},
}));

const mockElectronAPI = {
  repo: {
    browseDirectory: vi.fn().mockResolvedValue("/tmp/patches"),
    browseFile: vi.fn().mockResolvedValue("/tmp/fix.patch"),
  },
  patch: {
    create: vi.fn().mockResolvedValue(["0001-fix.patch"]),
    apply: vi.fn().mockResolvedValue(undefined),
    preview: vi.fn().mockResolvedValue("diff --git a/foo.ts b/foo.ts\n..."),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

describe("PatchCreateDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <PatchCreateDialog open={false} onClose={vi.fn()} hashes={[]} subjects={[]} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog title when open", () => {
    render(
      <PatchCreateDialog
        open={true}
        onClose={vi.fn()}
        hashes={["abc1234"]}
        subjects={["fix: something"]}
      />
    );
    // Title and button both read "Create Patch" — verify at least one exists
    expect(screen.getAllByText("Create Patch").length).toBeGreaterThanOrEqual(1);
  });

  it("shows commit count and subject list", () => {
    render(
      <PatchCreateDialog
        open={true}
        onClose={vi.fn()}
        hashes={["abc1234", "def5678"]}
        subjects={["fix: one", "feat: two"]}
      />
    );
    expect(screen.getByText(/2 commit\(s\)/)).toBeInTheDocument();
    expect(screen.getByText("fix: one")).toBeInTheDocument();
    expect(screen.getByText("feat: two")).toBeInTheDocument();
  });

  it("renders Create Patch confirm button and Cancel button", () => {
    render(
      <PatchCreateDialog
        open={true}
        onClose={vi.fn()}
        hashes={["abc1234"]}
        subjects={["fix: x"]}
      />
    );
    expect(screen.getByRole("button", { name: "Create Patch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <PatchCreateDialog
        open={true}
        onClose={onClose}
        hashes={["abc1234"]}
        subjects={["fix: x"]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("opens directory browser and calls patch.create on Create Patch click", async () => {
    render(
      <PatchCreateDialog
        open={true}
        onClose={vi.fn()}
        hashes={["abc1234"]}
        subjects={["fix: x"]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Create Patch" }));
    await vi.waitFor(() => {
      expect(mockElectronAPI.repo.browseDirectory).toHaveBeenCalledOnce();
      expect(mockElectronAPI.patch.create).toHaveBeenCalledWith(
        ["abc1234"],
        "/tmp/patches"
      );
    });
  });

  it("shows success message after patch creation", async () => {
    render(
      <PatchCreateDialog
        open={true}
        onClose={vi.fn()}
        hashes={["abc1234"]}
        subjects={["fix: x"]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Create Patch" }));
    await vi.waitFor(() => {
      expect(screen.getByText(/Created 1 patch file/)).toBeInTheDocument();
    });
  });
});

describe("PatchApplyDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<PatchApplyDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog title when open", () => {
    render(<PatchApplyDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Apply Patch")).toBeInTheDocument();
  });

  it("renders Browse button", () => {
    render(<PatchApplyDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Browse")).toBeInTheDocument();
  });

  it("renders Apply and Cancel buttons", () => {
    render(<PatchApplyDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Apply")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders patch path input as readonly", () => {
    render(<PatchApplyDialog open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(
      "Select a patch file..."
    ) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<PatchApplyDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls browseFile and patch.preview on Browse click", async () => {
    render(<PatchApplyDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Browse"));
    await vi.waitFor(() => {
      expect(mockElectronAPI.repo.browseFile).toHaveBeenCalledOnce();
      expect(mockElectronAPI.patch.preview).toHaveBeenCalledWith("/tmp/fix.patch");
    });
    const input = screen.getByPlaceholderText(
      "Select a patch file..."
    ) as HTMLInputElement;
    expect(input.value).toBe("/tmp/fix.patch");
  });

  it("shows error when Apply is clicked with no file selected", async () => {
    render(<PatchApplyDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Apply"));
    await vi.waitFor(() => {
      expect(screen.getByText("Select a patch file")).toBeInTheDocument();
    });
  });
});
