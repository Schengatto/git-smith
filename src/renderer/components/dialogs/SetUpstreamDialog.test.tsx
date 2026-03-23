// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { SetUpstreamDialog } from "./SetUpstreamDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

vi.mock("../../store/repo-store", () => ({
  useRepoStore: () => ({
    refreshInfo: vi.fn().mockResolvedValue(undefined),
    refreshStatus: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../store/graph-store", () => ({
  useGraphStore: () => ({
    loadGraph: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../../store/git-operation-store", () => ({
  runGitOperation: vi.fn(),
  GitOperationCancelledError: class extends Error {},
}));

const mockElectronAPI = {
  remote: {
    list: vi.fn().mockResolvedValue([{ name: "origin", fetchUrl: "https://github.com/x/y.git" }]),
    push: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
  mockElectronAPI.remote.list.mockResolvedValue([
    { name: "origin", fetchUrl: "https://github.com/x/y.git" },
  ]);
});

describe("SetUpstreamDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <SetUpstreamDialog
        open={false}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    expect(screen.getByText("setUpstream.title")).toBeInTheDocument();
  });

  it("shows the suggested branch name", () => {
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="feature/my-branch"
      />
    );
    expect(screen.getByText("feature/my-branch")).toBeInTheDocument();
  });

  it("shows Branch and Remote labels", () => {
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    expect(screen.getByText("setUpstream.branch")).toBeInTheDocument();
    expect(screen.getByText("setUpstream.remote")).toBeInTheDocument();
  });

  it("loads and displays remotes in a select", async () => {
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "origin" })).toBeInTheDocument();
    });
  });

  it("shows error message when no remotes are configured", async () => {
    mockElectronAPI.remote.list.mockResolvedValue([]);
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    await waitFor(() => {
      expect(screen.getByText("setUpstream.noRemotes")).toBeInTheDocument();
    });
  });

  it("shows Push & Set Upstream confirm button", () => {
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    expect(
      screen.getByRole("button", { name: "setUpstream.pushAndSetUpstream" })
    ).toBeInTheDocument();
  });

  it("shows force push warning when force=true", () => {
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
        force={true}
      />
    );
    expect(screen.getByText("setUpstream.forcePushWarning")).toBeInTheDocument();
  });

  it("shows Force Push & Set Upstream label when force=true", () => {
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
        force={true}
      />
    );
    expect(
      screen.getByRole("button", { name: "setUpstream.forcePushAndSetUpstream" })
    ).toBeInTheDocument();
  });

  it("shows Add Remote button when no remotes are configured", async () => {
    mockElectronAPI.remote.list.mockResolvedValue([]);
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    await waitFor(() => {
      expect(screen.getByText("setUpstream.addRemote")).toBeInTheDocument();
    });
  });

  it("shows add remote form when Add Remote button is clicked", async () => {
    mockElectronAPI.remote.list.mockResolvedValue([]);
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    await waitFor(() => {
      expect(screen.getByText("setUpstream.addRemote")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("setUpstream.addRemote"));
    expect(screen.getByPlaceholderText("origin")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://github.com/user/repo.git")).toBeInTheDocument();
  });

  it("calls remote.add and reloads remotes on submit", async () => {
    mockElectronAPI.remote.list
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ name: "origin", fetchUrl: "https://github.com/user/repo.git" }]);
    render(
      <SetUpstreamDialog
        open={true}
        onClose={vi.fn()}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    await waitFor(() => {
      expect(screen.getByText("setUpstream.addRemote")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("setUpstream.addRemote"));
    fireEvent.change(screen.getByPlaceholderText("origin"), { target: { value: "origin" } });
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://github.com/user/repo.git" },
    });
    fireEvent.click(screen.getByText("setUpstream.add"));
    await waitFor(() => {
      expect(mockElectronAPI.remote.add).toHaveBeenCalledWith(
        "origin",
        "https://github.com/user/repo.git"
      );
    });
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  it("calls onClose when Cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <SetUpstreamDialog
        open={true}
        onClose={onClose}
        suggestedRemote="origin"
        suggestedBranch="main"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
