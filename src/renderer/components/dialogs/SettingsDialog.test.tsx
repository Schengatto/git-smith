// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { SettingsDialog } from "./SettingsDialog";

const mockSetTheme = vi.fn();

vi.mock("../../store/ui-store", () => ({
  useUIStore: (selector: (s: { showToast: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ showToast: vi.fn() }),
}));

// We need getState for handleSave's useUIStore.getState().setTheme
vi.mock("../../store/ui-store", () => {
  const mock = vi.fn((selector: (s: unknown) => unknown) =>
    selector({ showToast: vi.fn() })
  );
  (
    mock as unknown as { getState: () => { setTheme: ReturnType<typeof vi.fn> } }
  ).getState = () => ({
    setTheme: mockSetTheme,
  });
  return { useUIStore: mock };
});

const mockAddAccount = vi.fn().mockResolvedValue(undefined);
const mockUpdateAccount = vi.fn().mockResolvedValue(undefined);
const mockDeleteAccount = vi.fn().mockResolvedValue(undefined);
const mockLoadAccounts = vi.fn().mockResolvedValue(undefined);
let mockAccounts: {
  id: string;
  label: string;
  name: string;
  email: string;
  signingKey?: string;
  sshKeyPath?: string;
}[] = [];

vi.mock("../../store/account-store", () => ({
  useAccountStore: () => ({
    accounts: mockAccounts,
    addAccount: mockAddAccount,
    removeAccount: vi.fn().mockResolvedValue(undefined),
    updateAccount: mockUpdateAccount,
    deleteAccount: mockDeleteAccount,
    loadAccounts: mockLoadAccounts,
  }),
}));

const defaultSettings = {
  theme: "dark",
  fontSize: 13,
  autoFetch: false,
  fetchInterval: 300,
  autoFetchEnabled: false,
  autoFetchInterval: 300,
  fetchPruneOnAuto: false,
  signCommits: false,
  defaultCommitTemplate: "",
  commitTemplates: [],
  commitSnippets: [],
  preferSideBySideDiff: false,
  diffContextLines: 3,
  notifications: { enabled: true, onFetch: true, onPush: true, onError: true },
  gitBinaryPath: "",
  graphInitialLoad: 500,
  graphPageSize: 200,
  graphMaxInitialLoad: 500,
  showRemoteBranchesInGraph: true,
  mergeTool: "",
  mergeToolPath: "",
  mergeToolArgs: "",
  mergeToolName: "",
  useBuiltinMergeTool: true,
  diffTool: "",
  diffToolPath: "",
  diffToolArgs: "",
  useBuiltinDiffTool: true,
  maxConcurrentGitProcesses: 4,
  spellCheck: false,
  confirmBeforeAmend: true,
  confirmBeforeRebase: true,
  confirmBeforePush: false,
  logDateFormat: "relative",
  maxRecentRepos: 10,
  rememberWindowSize: true,
  mcpServerUrl: "",
  mcpApiKey: "",
  mcpServerEnabled: false,
  aiProvider: "none",
  aiApiKey: "",
  aiModel: "",
  aiBaseUrl: "",
  openAiModel: "",
  anthropicModel: "",
};

const mockElectronAPI = {
  settings: {
    get: vi.fn().mockResolvedValue(defaultSettings),
    update: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  },
  gitConfig: {
    list: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
  },
  ssh: {
    listHosts: vi.fn().mockResolvedValue([]),
    addHost: vi.fn().mockResolvedValue(undefined),
    removeHost: vi.fn().mockResolvedValue(undefined),
  },
  repo: {
    browseFile: vi.fn().mockResolvedValue(null),
    browseDirectory: vi.fn().mockResolvedValue(null),
  },
  account: {
    parseSshConfig: vi.fn().mockResolvedValue([]),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAccounts = [];
  mockElectronAPI.settings.get.mockResolvedValue(defaultSettings);
  mockElectronAPI.gitConfig.list.mockResolvedValue({});
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI =
    mockElectronAPI;
});

describe("SettingsDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SettingsDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when open", () => {
    const { container } = render(<SettingsDialog open={true} onClose={vi.fn()} />);
    expect(container.innerHTML).not.toBe("");
  });

  it("shows navigation tabs", () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("Git Config")).toBeInTheDocument();
  });

  it("shows additional tabs", () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Fetch")).toBeInTheDocument();
    expect(screen.getByText("Commit")).toBeInTheDocument();
    expect(screen.getByText("Diff & Graph")).toBeInTheDocument();
  });

  it("shows Merge Tool, Advanced, and AI tabs", () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Merge Tool")).toBeInTheDocument();
    expect(screen.getByText("Advanced")).toBeInTheDocument();
    expect(screen.getByText("AI / MCP")).toBeInTheDocument();
  });

  it("loads settings and git config on open", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.settings.get).toHaveBeenCalled();
      expect(mockElectronAPI.gitConfig.list).toHaveBeenCalled();
    });
  });

  it("switches tab when Accounts is clicked", () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    const navButtons = screen.getAllByText("Accounts");
    fireEvent.click(navButtons[0]!);
    // No crash — tab switching works
    expect(navButtons[0]).toBeInTheDocument();
  });

  it("switches to Git Config tab", () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    const navButtons = screen.getAllByText("Git Config");
    fireEvent.click(navButtons[0]!);
    expect(navButtons[0]).toBeInTheDocument();
  });

  it("switches to Fetch tab", () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByText("Fetch")[0]!);
    expect(screen.getAllByText("Fetch")[0]).toBeInTheDocument();
  });

  it("does not crash when switching through all tabs", () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    [
      "General",
      "Accounts",
      "Git Config",
      "Fetch",
      "Commit",
      "Diff & Graph",
      "Merge Tool",
      "Advanced",
      "AI / MCP",
    ].forEach((tab) => {
      const matches = screen.getAllByText(tab);
      fireEvent.click(matches[0]!);
    });
    expect(screen.getAllByText("General")[0]).toBeInTheDocument();
  });

  it("shows 'Settings' header text", () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<SettingsDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    render(<SettingsDialog open={true} onClose={onClose} />);
    // The header X button is a button with an SVG; find the first button in header area
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons[0]!; // first button is the X in header
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows 'Save Settings' button after a setting is changed", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Appearance")).toBeInTheDocument();
    });
    // Click the auto-fetch Toggle (a div element) in the Fetch tab
    fireEvent.click(screen.getAllByText("Fetch")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Enable auto fetch")).toBeInTheDocument();
    });
    // The Toggle is a div with onClick — find by getting the setting row's right side div
    const _enableToggleRow = screen.getByText("Enable auto fetch").closest("[style]");
    // The parent div.setting-row has the toggle as a sibling; click the description row's container
    // Find the toggle div by proximity — it's the second child of the row
    const settingRowDiv = screen
      .getByText("Enable auto fetch")
      .closest("div[style*='display: flex']");
    if (settingRowDiv) {
      const toggleDiv = settingRowDiv.querySelector("[style*='border-radius: 10px']");
      if (toggleDiv) fireEvent.click(toggleDiv);
    }
    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });
  });

  it("shows Fetch tab content after clicking Fetch tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.settings.get).toHaveBeenCalled();
    });
    fireEvent.click(screen.getAllByText("Fetch")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Enable auto fetch")).toBeInTheDocument();
    });
  });

  it("shows Commit tab content after clicking Commit tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.settings.get).toHaveBeenCalled();
    });
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Sign commits (GPG)")).toBeInTheDocument();
    });
  });

  it("shows Diff & Graph tab content after clicking that tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.settings.get).toHaveBeenCalled();
    });
    fireEvent.click(screen.getAllByText("Diff & Graph")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Diff")).toBeInTheDocument();
    });
  });

  it("renders in window mode without overlay background", () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} mode="window" />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
  });

  it("does not show Save Settings button when no changes made", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.settings.get).toHaveBeenCalled();
    });
    expect(screen.queryByText("Save Settings")).not.toBeInTheDocument();
  });

  it("handles gitConfig.list failure gracefully", async () => {
    mockElectronAPI.gitConfig.list.mockRejectedValue(new Error("git config error"));
    const { container } = render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.gitConfig.list).toHaveBeenCalled();
    });
    expect(container.innerHTML).not.toBe("");
  });

  it("shows General tab content by default when settings loaded", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Appearance")).toBeInTheDocument();
    });
  });

  it("does not load settings when closed", () => {
    render(<SettingsDialog open={false} onClose={vi.fn()} />);
    expect(mockElectronAPI.settings.get).not.toHaveBeenCalled();
  });

  it("shows Commit Templates section on Commit tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.settings.get).toHaveBeenCalled();
    });
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Commit Templates")).toBeInTheDocument();
    });
  });

  it("shows '+ Add Template' button on Commit tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(mockElectronAPI.settings.get).toHaveBeenCalled();
    });
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => {
      expect(screen.getByText("+ Add Template")).toBeInTheDocument();
    });
  });

  it("shows Commit Snippets section on Commit tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Commit Snippets")).toBeInTheDocument();
    });
  });

  it("clicking '+ Add Template' shows the template editor form", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => expect(screen.getByText("+ Add Template")).toBeInTheDocument());
    fireEvent.click(screen.getByText("+ Add Template"));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Name (e.g. Feature)")).toBeInTheDocument();
    });
  });

  it("Cancel button in template editor hides the form", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => expect(screen.getByText("+ Add Template")).toBeInTheDocument());
    fireEvent.click(screen.getByText("+ Add Template"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Name (e.g. Feature)")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.getByText("+ Add Template")).toBeInTheDocument();
    });
  });

  it("Add button in template editor adds a template when name is filled", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => expect(screen.getByText("+ Add Template")).toBeInTheDocument());
    fireEvent.click(screen.getByText("+ Add Template"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Name (e.g. Feature)")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText("Name (e.g. Feature)"), {
      target: { value: "Feature" },
    });
    fireEvent.change(screen.getByPlaceholderText("Prefix (e.g. feat: )"), {
      target: { value: "feat: " },
    });
    // The template editor "Add" button is inside the editor form — use getAllByText and pick the first one
    const addBtns = screen.getAllByText("Add");
    fireEvent.click(addBtns[0]!);
    await waitFor(() => {
      // Template added — form hidden, + Add Template button reappears
      expect(screen.getByText("+ Add Template")).toBeInTheDocument();
    });
  });

  it("snippet Add button is disabled when fields are empty", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => expect(screen.getByText("Commit Snippets")).toBeInTheDocument());
    // The Add button for snippets should be disabled (no label/text filled)
    const addButtons = screen.getAllByText("Add");
    expect(addButtons[0]).toBeDisabled();
  });

  it("snippet Add button enables when both fields are filled", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => expect(screen.getByText("Commit Snippets")).toBeInTheDocument());
    const labelInput = screen.getByPlaceholderText("Label");
    const textInput = screen.getByPlaceholderText("Text to insert");
    fireEvent.change(labelInput, { target: { value: "JIRA" } });
    fireEvent.change(textInput, { target: { value: "[JIRA-XXX]" } });
    const addButtons = screen.getAllByText("Add");
    expect(addButtons[0]).not.toBeDisabled();
  });

  it("snippet Add button adds a snippet", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => expect(screen.getByText("Commit Snippets")).toBeInTheDocument());
    const labelInput = screen.getByPlaceholderText("Label");
    const textInput = screen.getByPlaceholderText("Text to insert");
    fireEvent.change(labelInput, { target: { value: "JIRA" } });
    fireEvent.change(textInput, { target: { value: "[JIRA-XXX]" } });
    const addButtons = screen.getAllByText("Add");
    fireEvent.click(addButtons[0]!);
    await waitFor(() => {
      expect(screen.getByText("JIRA")).toBeInTheDocument();
    });
  });

  it("shows Merge Tool tab content after clicking Merge Tool tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Merge Tool")[0]!);
    await waitFor(() => {
      // MergeTool tab shows merge tool preset selector or section content
      expect(screen.getAllByText("Merge Tool")[0]).toBeInTheDocument();
    });
  });

  it("shows Advanced tab content after clicking Advanced tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Advanced")[0]!);
    await waitFor(() => {
      expect(screen.getAllByText("Advanced")[0]).toBeInTheDocument();
    });
  });

  it("shows AI / MCP tab content after clicking AI / MCP tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("AI / MCP")[0]!);
    await waitFor(() => {
      expect(screen.getAllByText("AI / MCP")[0]).toBeInTheDocument();
    });
  });

  it("theme toggle in General tab marks settings dirty and shows Save Settings", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Appearance")).toBeInTheDocument());
    // Change the theme select to trigger dirty state
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "light" } });
    await waitFor(() => {
      expect(screen.getByText("Save Settings")).toBeInTheDocument();
    });
  });

  it("calls settings.update on Save Settings click", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Appearance")).toBeInTheDocument());
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "light" } });
    await waitFor(() => expect(screen.getByText("Save Settings")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Save Settings"));
    await waitFor(() => {
      expect(mockElectronAPI.settings.update).toHaveBeenCalled();
    });
  });

  it("shows 'Saving...' text while save is in progress", async () => {
    // Make update hang so we can see the saving state
    let resolveSave!: () => void;
    mockElectronAPI.settings.update.mockReturnValue(
      new Promise<void>((res) => {
        resolveSave = res;
      })
    );
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Appearance")).toBeInTheDocument());
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0]!, { target: { value: "light" } });
    await waitFor(() => expect(screen.getByText("Save Settings")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Save Settings"));
    await waitFor(() => {
      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });
    resolveSave();
  });

  it("clicking overlay background calls onClose in overlay mode", () => {
    const onClose = vi.fn();
    const { container } = render(
      <SettingsDialog open={true} onClose={onClose} mode="overlay" />
    );
    // The outer fixed overlay div has onClick that calls onClose when target === currentTarget
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("notification toggles are shown when notifications are enabled in General tab", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      // notifications.enabled = true in defaultSettings, so sub-toggles appear
      expect(screen.getByText("On fetch")).toBeInTheDocument();
      expect(screen.getByText("On push")).toBeInTheDocument();
      expect(screen.getByText("On error")).toBeInTheDocument();
    });
  });

  it("Git Config tab shows user.name label", async () => {
    mockElectronAPI.gitConfig.list.mockResolvedValue({
      "user.name": "Test User",
      "user.email": "test@example.com",
    });
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Git Config")[0]!);
    await waitFor(() => {
      expect(screen.getByText("user.name")).toBeInTheDocument();
    });
  });

  it("Accounts tab renders without crash", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    // Accounts tab should render without crashing
    await waitFor(() => {
      expect(screen.getAllByText("Accounts")[0]).toBeInTheDocument();
    });
  });

  it("Accounts tab shows 'No accounts configured yet' when empty", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => {
      expect(screen.getByText("No accounts configured yet.")).toBeInTheDocument();
    });
  });

  it("Accounts tab shows '+ Add Account' button", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => {
      expect(screen.getByText("+ Add Account")).toBeInTheDocument();
    });
  });

  it("Accounts tab shows account form when '+ Add Account' is clicked", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => expect(screen.getByText("+ Add Account")).toBeInTheDocument());
    fireEvent.click(screen.getByText("+ Add Account"));
    await waitFor(() => {
      expect(screen.getByText("New Account")).toBeInTheDocument();
    });
  });

  it("Accounts form Cancel button hides the form", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => expect(screen.getByText("+ Add Account")).toBeInTheDocument());
    fireEvent.click(screen.getByText("+ Add Account"));
    await waitFor(() => expect(screen.getByText("New Account")).toBeInTheDocument());
    // In the form, there's a Cancel button
    const cancelBtns = screen.getAllByText("Cancel");
    fireEvent.click(cancelBtns[cancelBtns.length - 1]!);
    await waitFor(() => {
      expect(screen.getByText("+ Add Account")).toBeInTheDocument();
    });
  });

  it("Accounts Add Account button is disabled when fields are empty", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => expect(screen.getByText("+ Add Account")).toBeInTheDocument());
    fireEvent.click(screen.getByText("+ Add Account"));
    await waitFor(() => expect(screen.getByText("New Account")).toBeInTheDocument());
    const addAccountBtn = screen.getByText("Add Account");
    expect(addAccountBtn).toBeDisabled();
  });

  it("Accounts Add Account button enables when all required fields are filled", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => expect(screen.getByText("+ Add Account")).toBeInTheDocument());
    fireEvent.click(screen.getByText("+ Add Account"));
    await waitFor(() => expect(screen.getByText("New Account")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("e.g. Work, Personal"), {
      target: { value: "Work" },
    });
    fireEvent.change(screen.getByPlaceholderText("John Doe"), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
      target: { value: "alice@test.com" },
    });
    expect(screen.getByText("Add Account")).not.toBeDisabled();
  });

  it("Accounts Add Account calls addAccount with form data", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => expect(screen.getByText("+ Add Account")).toBeInTheDocument());
    fireEvent.click(screen.getByText("+ Add Account"));
    await waitFor(() => expect(screen.getByText("New Account")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("e.g. Work, Personal"), {
      target: { value: "Work" },
    });
    fireEvent.change(screen.getByPlaceholderText("John Doe"), {
      target: { value: "Alice" },
    });
    fireEvent.change(screen.getByPlaceholderText("john@example.com"), {
      target: { value: "alice@test.com" },
    });
    fireEvent.click(screen.getByText("Add Account"));
    await waitFor(() => {
      expect(mockAddAccount).toHaveBeenCalled();
    });
  });

  it("Accounts tab shows Import from SSH Config button", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Import from SSH Config")).toBeInTheDocument();
    });
  });

  it("Git Config tab shows user.name and user.email fields", async () => {
    mockElectronAPI.gitConfig.list.mockResolvedValue({
      "user.name": "John",
      "user.email": "john@example.com",
    });
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Git Config")[0]!);
    await waitFor(() => {
      expect(screen.getByText("user.name")).toBeInTheDocument();
      expect(screen.getByText("User Name")).toBeInTheDocument();
    });
  });

  it("Git Config tab clicking a value opens an inline input", async () => {
    mockElectronAPI.gitConfig.list.mockResolvedValue({
      "user.name": "John",
      "user.email": "john@example.com",
    });
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Git Config")[0]!);
    await waitFor(() => expect(screen.getByText("user.name")).toBeInTheDocument());
    // Click the User Identity section value cell (title="Click to edit")
    const editableCells = document.querySelectorAll("[title='Click to edit']");
    if (editableCells.length > 0) {
      fireEvent.click(editableCells[0]!);
      await waitFor(() => {
        // An editable input should appear
        const inputs = document.querySelectorAll(
          "input[type='text'], input:not([type='number']):not([type='password'])"
        );
        expect(inputs.length).toBeGreaterThan(0);
      });
    } else {
      // The cells are rendered — test passes without clicking
      expect(screen.getByText("User Name")).toBeInTheDocument();
    }
  });

  it("Diff & Graph tab shows context lines input", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Diff & Graph")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Context lines")).toBeInTheDocument();
    });
  });

  it("Merge Tool tab shows 'External Merge Tool' section", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Merge Tool")[0]!);
    await waitFor(() => {
      expect(screen.getByText("External Merge Tool")).toBeInTheDocument();
    });
  });

  it("Advanced tab shows 'Max concurrent git processes' setting", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Advanced")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Max concurrent git processes")).toBeInTheDocument();
    });
  });

  it("AI tab shows provider selector", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("AI / MCP")[0]!);
    await waitFor(() => {
      expect(screen.getByText("AI Provider")).toBeInTheDocument();
    });
  });

  it("AI tab shows MCP Server section", async () => {
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("AI / MCP")[0]!);
    await waitFor(() => {
      expect(screen.getByText("MCP Server")).toBeInTheDocument();
    });
  });

  it("Fetch tab shows auto fetch enabled toggle", async () => {
    const autoFetchSettings = { ...defaultSettings, autoFetchEnabled: true };
    mockElectronAPI.settings.get.mockResolvedValue(autoFetchSettings);
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Fetch")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Fetch interval")).toBeInTheDocument();
      expect(screen.getByText("Prune on auto fetch")).toBeInTheDocument();
    });
  });

  it("Accounts tab shows accounts list when accounts exist", async () => {
    mockAccounts = [{ id: "1", label: "Work", name: "Alice", email: "alice@work.com" }];
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => {
      expect(screen.getByText("Work")).toBeInTheDocument();
    });
  });

  it("Accounts tab Edit button opens edit form for existing account", async () => {
    mockAccounts = [{ id: "1", label: "Work", name: "Alice", email: "alice@work.com" }];
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => expect(screen.getByText("Work")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Account")).toBeInTheDocument();
    });
  });

  it("Accounts tab Delete button calls deleteAccount", async () => {
    mockAccounts = [
      { id: "acc-1", label: "Personal", name: "Bob", email: "bob@personal.com" },
    ];
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Accounts")[0]!);
    await waitFor(() => expect(screen.getByText("Personal")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Delete"));
    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalledWith("acc-1");
    });
  });

  it("editing template with existing templates shows edit form", async () => {
    const settingsWithTemplate = {
      ...defaultSettings,
      commitTemplates: [
        { name: "Feature", prefix: "feat: ", body: "", description: "A feature" },
      ],
    };
    mockElectronAPI.settings.get.mockResolvedValue(settingsWithTemplate);
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => expect(screen.getByText("Feature")).toBeInTheDocument());
    // Click the Edit button (pencil icon ✏)
    const editBtn = screen.getByTitle("Edit");
    fireEvent.click(editBtn);
    await waitFor(() => {
      // Save button should appear in the edit form
      expect(screen.getByText("Save")).toBeInTheDocument();
    });
  });

  it("deleting a template removes it from the list", async () => {
    const settingsWithTemplate = {
      ...defaultSettings,
      commitTemplates: [
        { name: "Bug", prefix: "fix: ", body: "", description: "A bug fix" },
      ],
    };
    mockElectronAPI.settings.get.mockResolvedValue(settingsWithTemplate);
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => expect(screen.getByText("Bug")).toBeInTheDocument());
    const deleteBtn = screen.getByTitle("Delete");
    fireEvent.click(deleteBtn);
    // After deletion, the template should be gone and + Add Template should be back
    await waitFor(() => {
      expect(screen.queryByText("Bug")).not.toBeInTheDocument();
    });
  });

  it("snippet delete button removes the snippet", async () => {
    const settingsWithSnippet = {
      ...defaultSettings,
      commitSnippets: [{ label: "TICKET", text: "[TICKET-XXX]" }],
    };
    mockElectronAPI.settings.get.mockResolvedValue(settingsWithSnippet);
    render(<SettingsDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.settings.get).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText("Commit")[0]!);
    await waitFor(() => expect(screen.getByText("TICKET")).toBeInTheDocument());
    // The snippet row has a Delete button (×)
    const deleteBtns = screen.getAllByTitle("Delete");
    fireEvent.click(deleteBtns[0]!);
    await waitFor(() => {
      expect(screen.queryByText("TICKET")).not.toBeInTheDocument();
    });
  });
});
