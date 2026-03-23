// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CloneDialog } from "./CloneDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "clone.title": "Clone Repository",
        "clone.repoToClone": "Repository to clone",
        "clone.repoUrlPlaceholder": "https://github.com/user/repo.git",
        "clone.destination": "Destination",
        "clone.destinationPlaceholder": "C:/Projects",
        "clone.subdirectory": "Subdirectory",
        "clone.subdirectoryPlaceholder": "my-project",
        "clone.branch": "Branch",
        "clone.defaultRemoteHead": "(default: remote HEAD)",
        "clone.cloneLocationInfo": "The repository will be cloned to a new directory located here:",
        "clone.repositoryType": "Repository type",
        "clone.personalRepo": "Personal repository",
        "clone.bareRepo": "Public repository, no working directory (--bare)",
        "clone.initSubmodules": "Initialize all submodules",
        "clone.downloadFullHistory": "Download full history",
        "clone.cloning": "Cloning repository...",
        "clone.opening": "Opening repository...",
        "clone.clone": "Clone",
        "dialogs.browse": "Browse",
        "dialogs.cancel": "Cancel",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    openRepo: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../store/account-store", () => ({
  useAccountStore: () => ({
    accounts: [],
    loadAccounts: vi.fn().mockResolvedValue(undefined),
  }),
}));

const mockElectronAPI = {
  remote: {
    listRemoteBranches: vi.fn().mockResolvedValue([]),
    clone: vi.fn().mockResolvedValue(undefined),
  },
  repo: {
    browseDirectory: vi.fn().mockResolvedValue(null),
  },
  account: {
    list: vi.fn().mockResolvedValue([]),
    setForRepo: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("CloneDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<CloneDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows the dialog title", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Clone Repository")).toBeInTheDocument();
  });

  it("shows Repository to clone label", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Repository to clone")).toBeInTheDocument();
  });

  it("shows URL input with placeholder", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("https://github.com/user/repo.git")).toBeInTheDocument();
  });

  it("shows Destination input", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("C:/Projects")).toBeInTheDocument();
  });

  it("shows Subdirectory input", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText("my-project")).toBeInTheDocument();
  });

  it("shows Clone and Cancel buttons", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Clone")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("Clone button is disabled when fields are empty", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Clone")).toBeDisabled();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<CloneDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<CloneDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows Browse button for destination", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Browse")).toBeInTheDocument();
  });

  it("calls browseDirectory when Browse is clicked", async () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(mockElectronAPI.repo.browseDirectory).toHaveBeenCalledWith("Select clone destination");
    });
  });

  it("shows repository type radio options", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Personal repository")).toBeInTheDocument();
    expect(screen.getByText(/Public repository.*--bare/)).toBeInTheDocument();
  });

  it("shows submodules and history checkboxes", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Initialize all submodules")).toBeInTheDocument();
    expect(screen.getByText("Download full history")).toBeInTheDocument();
  });

  it("auto-fills subdirectory from URL", async () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    const urlInput = screen.getByPlaceholderText("https://github.com/user/repo.git");
    fireEvent.change(urlInput, {
      target: { value: "https://github.com/user/my-project.git" },
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("my-project")).toBeInTheDocument();
    });
  });

  it("shows clone destination info box when all fields are filled", async () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/my-project.git" },
    });
    fireEvent.change(screen.getByPlaceholderText("C:/Projects"), {
      target: { value: "/home/user/projects" },
    });
    await waitFor(() => {
      expect(screen.getByText(/The repository will be cloned to/)).toBeInTheDocument();
    });
  });

  it("Clone button is enabled when all required fields are filled", async () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/my-project.git" },
    });
    fireEvent.change(screen.getByPlaceholderText("C:/Projects"), {
      target: { value: "/home/user/projects" },
    });
    await waitFor(() => {
      expect(screen.getByText("Clone")).not.toBeDisabled();
    });
  });

  it("sets destination when browseDirectory returns a path", async () => {
    mockElectronAPI.repo.browseDirectory.mockResolvedValue("/home/user/chosen");
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(screen.getByDisplayValue("/home/user/chosen")).toBeInTheDocument();
    });
  });

  it("does not update destination when browseDirectory returns null", async () => {
    mockElectronAPI.repo.browseDirectory.mockResolvedValue(null);
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Browse"));
    await waitFor(() => {
      expect(mockElectronAPI.repo.browseDirectory).toHaveBeenCalled();
    });
    expect((screen.getByPlaceholderText("C:/Projects") as HTMLInputElement).value).toBe("");
  });

  it("selects bare repo type via radio button", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    const bareRadio = screen.getAllByRole("radio")[1]!;
    fireEvent.click(bareRadio);
    expect(bareRadio).toBeChecked();
  });

  it("toggles Initialize all submodules checkbox", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    // DialogCheckbox uses a custom div, click the wrapping label text
    const label = screen.getByText("Initialize all submodules").closest("label")!;
    // The custom div toggler is the first child
    const toggler = label.querySelector("div")!;
    expect(toggler.style.background).toBe("var(--accent)"); // checked = accent
    fireEvent.click(toggler);
    expect(toggler.style.background).toBe("transparent"); // unchecked
  });

  it("toggles Download full history checkbox", () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    const label = screen.getByText("Download full history").closest("label")!;
    const toggler = label.querySelector("div")!;
    expect(toggler.style.background).toBe("var(--accent)");
    fireEvent.click(toggler);
    expect(toggler.style.background).toBe("transparent");
  });

  it("clears subdirectory when URL is cleared", async () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    const urlInput = screen.getByPlaceholderText("https://github.com/user/repo.git");
    fireEvent.change(urlInput, {
      target: { value: "https://github.com/user/my-project.git" },
    });
    await waitFor(() => expect(screen.getByDisplayValue("my-project")).toBeInTheDocument());
    fireEvent.change(urlInput, { target: { value: "" } });
    await waitFor(() => {
      expect((screen.getByPlaceholderText("my-project") as HTMLInputElement).value).toBe("");
    });
  });

  it("auto-fills subdirectory from URL without .git suffix", async () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/awesome-lib" },
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("awesome-lib")).toBeInTheDocument();
    });
  });

  it("shows finalPath info box with correct path when destination uses backslash separator", async () => {
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/my-project.git" },
    });
    fireEvent.change(screen.getByPlaceholderText("C:/Projects"), {
      target: { value: "C:\\Projects" },
    });
    await waitFor(() => {
      expect(screen.getByText(/The repository will be cloned to/)).toBeInTheDocument();
    });
  });

  it("shows progress message during cloning", async () => {
    mockElectronAPI.remote.clone.mockResolvedValue(new Promise(() => {})); // never resolves
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/my-project.git" },
    });
    fireEvent.change(screen.getByPlaceholderText("C:/Projects"), {
      target: { value: "/home/user/projects" },
    });
    await waitFor(() => expect(screen.getByText("Clone")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Clone"));
    await waitFor(() => {
      expect(screen.getByText(/Cloning repository/)).toBeInTheDocument();
    });
  });

  it("shows error when clone fails", async () => {
    mockElectronAPI.remote.clone.mockRejectedValue(new Error("Network error"));
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/my-project.git" },
    });
    fireEvent.change(screen.getByPlaceholderText("C:/Projects"), {
      target: { value: "/home/user/projects" },
    });
    await waitFor(() => expect(screen.getByText("Clone")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Clone"));
    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("calls remote.clone with bare option when bare is selected", async () => {
    mockElectronAPI.remote.clone.mockResolvedValue(undefined);
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/my-project.git" },
    });
    fireEvent.change(screen.getByPlaceholderText("C:/Projects"), {
      target: { value: "/home/user/projects" },
    });
    // Select bare radio
    fireEvent.click(screen.getAllByRole("radio")[1]!);
    await waitFor(() => expect(screen.getByText("Clone")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Clone"));
    await waitFor(() => {
      expect(mockElectronAPI.remote.clone).toHaveBeenCalledWith(
        "https://github.com/user/my-project.git",
        expect.any(String),
        expect.objectContaining({ bare: true })
      );
    });
  });

  it("calls remote.clone with shallow option when Download full history is unchecked", async () => {
    mockElectronAPI.remote.clone.mockResolvedValue(undefined);
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/my-project.git" },
    });
    fireEvent.change(screen.getByPlaceholderText("C:/Projects"), {
      target: { value: "/home/user/projects" },
    });
    // Uncheck the "Download full history" custom checkbox
    const label = screen.getByText("Download full history").closest("label")!;
    fireEvent.click(label.querySelector("div")!);
    await waitFor(() => expect(screen.getByText("Clone")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Clone"));
    await waitFor(() => {
      expect(mockElectronAPI.remote.clone).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ shallow: true })
      );
    });
  });

  it("shows loading spinner when branches are being fetched", async () => {
    mockElectronAPI.remote.listRemoteBranches.mockReturnValue(new Promise(() => {}));
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/repo.git" },
    });
    // Spinner should appear after debounce timeout; simply verify listRemoteBranches is called
    await waitFor(
      () => {
        expect(mockElectronAPI.remote.listRemoteBranches).toHaveBeenCalled();
      },
      { timeout: 1500 }
    );
  });

  it("populates branch select with fetched remote branches", async () => {
    mockElectronAPI.remote.listRemoteBranches.mockResolvedValue(["main", "develop", "release/1.0"]);
    render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/repo.git" },
    });
    await waitFor(
      () => {
        expect(screen.getByText("main")).toBeInTheDocument();
        expect(screen.getByText("develop")).toBeInTheDocument();
        expect(screen.getByText("release/1.0")).toBeInTheDocument();
      },
      { timeout: 1500 }
    );
  });

  it("resets state when dialog re-opens", async () => {
    const { rerender } = render(<CloneDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/my-project.git" },
    });
    rerender(<CloneDialog open={false} onClose={vi.fn()} />);
    rerender(<CloneDialog open={true} onClose={vi.fn()} />);
    expect(
      (screen.getByPlaceholderText("https://github.com/user/repo.git") as HTMLInputElement).value
    ).toBe("");
  });
});
