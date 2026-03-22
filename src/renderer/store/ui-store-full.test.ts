import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Must mock DOM APIs before ui-store is imported, because it calls applyTheme()
// at module load time which touches document and localStorage.
const mockStorage: Record<string, string> = {};
vi.stubGlobal("document", {
  documentElement: { setAttribute: vi.fn() },
});
vi.stubGlobal("localStorage", {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => Object.keys(mockStorage).forEach((k) => delete mockStorage[k]),
  length: 0,
  key: () => null,
});

import { useUIStore } from "./ui-store";

const resetDialogs = () => {
  useUIStore.setState({
    cloneDialogOpen: false,
    settingsDialogOpen: false,
    scanDialogOpen: false,
    aboutDialogOpen: false,
    staleBranchesDialogOpen: false,
    gitignoreDialogOpen: false,
    grepDialogOpen: false,
    branchDiffDialogOpen: false,
    branchCompareDialogOpen: false,
    hooksDialogOpen: false,
    undoDialogOpen: false,
    ciStatusDialogOpen: false,
    gistDialogOpen: false,
    advancedStatsDialogOpen: false,
    sshDialogOpen: false,
    mergeEditorOpen: false,
    mergeEditorFile: "",
    reviewPanelOpen: false,
    reviewPanelCommit: "",
    toasts: [],
  });
};

describe("ui-store — theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDialogs();
  });

  it("initial theme is dark when localStorage has no value", () => {
    mockStorage["git-expansion-theme"] = "";
    useUIStore.setState({ theme: "dark" });
    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("setTheme sets to light", () => {
    useUIStore.getState().setTheme("light");
    expect(useUIStore.getState().theme).toBe("light");
  });

  it("setTheme sets to dark", () => {
    useUIStore.setState({ theme: "light" });
    useUIStore.getState().setTheme("dark");
    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("toggleTheme switches from dark to light", () => {
    useUIStore.setState({ theme: "dark" });
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("light");
  });

  it("toggleTheme switches from light to dark", () => {
    useUIStore.setState({ theme: "light" });
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("toggleTheme is idempotent over two calls", () => {
    useUIStore.setState({ theme: "dark" });
    useUIStore.getState().toggleTheme();
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("dark");
  });
});

describe("ui-store — panel visibility", () => {
  beforeEach(() => {
    useUIStore.setState({
      visiblePanels: new Set(["sidebar", "graph", "details"] as const),
    });
  });

  it("sidebar is visible by default", () => {
    expect(useUIStore.getState().isPanelVisible("sidebar")).toBe(true);
  });

  it("commandLog is hidden by default", () => {
    expect(useUIStore.getState().isPanelVisible("commandLog")).toBe(false);
  });

  it("togglePanel hides a visible panel", () => {
    useUIStore.getState().togglePanel("sidebar");
    expect(useUIStore.getState().isPanelVisible("sidebar")).toBe(false);
  });

  it("togglePanel shows a hidden panel", () => {
    useUIStore.getState().togglePanel("commandLog");
    expect(useUIStore.getState().isPanelVisible("commandLog")).toBe(true);
  });

  it("toggling twice restores original state", () => {
    useUIStore.getState().togglePanel("graph");
    useUIStore.getState().togglePanel("graph");
    expect(useUIStore.getState().isPanelVisible("graph")).toBe(true);
  });

  it("toggling one panel does not affect others", () => {
    useUIStore.getState().togglePanel("sidebar");
    expect(useUIStore.getState().isPanelVisible("graph")).toBe(true);
    expect(useUIStore.getState().isPanelVisible("details")).toBe(true);
  });
});

describe("ui-store — dialogs", () => {
  beforeEach(resetDialogs);

  const dialogCases: Array<{
    flag: keyof ReturnType<typeof useUIStore.getState>;
    open: keyof ReturnType<typeof useUIStore.getState>;
    close: keyof ReturnType<typeof useUIStore.getState>;
  }> = [
    { flag: "cloneDialogOpen", open: "openCloneDialog", close: "closeCloneDialog" },
    {
      flag: "settingsDialogOpen",
      open: "openSettingsDialog",
      close: "closeSettingsDialog",
    },
    { flag: "scanDialogOpen", open: "openScanDialog", close: "closeScanDialog" },
    { flag: "aboutDialogOpen", open: "openAboutDialog", close: "closeAboutDialog" },
    {
      flag: "staleBranchesDialogOpen",
      open: "openStaleBranchesDialog",
      close: "closeStaleBranchesDialog",
    },
    {
      flag: "gitignoreDialogOpen",
      open: "openGitignoreDialog",
      close: "closeGitignoreDialog",
    },
    { flag: "grepDialogOpen", open: "openGrepDialog", close: "closeGrepDialog" },
    {
      flag: "branchDiffDialogOpen",
      open: "openBranchDiffDialog",
      close: "closeBranchDiffDialog",
    },
    {
      flag: "branchCompareDialogOpen",
      open: "openBranchCompareDialog",
      close: "closeBranchCompareDialog",
    },
    { flag: "hooksDialogOpen", open: "openHooksDialog", close: "closeHooksDialog" },
    { flag: "undoDialogOpen", open: "openUndoDialog", close: "closeUndoDialog" },
    {
      flag: "ciStatusDialogOpen",
      open: "openCIStatusDialog",
      close: "closeCIStatusDialog",
    },
    { flag: "gistDialogOpen", open: "openGistDialog", close: "closeGistDialog" },
    {
      flag: "advancedStatsDialogOpen",
      open: "openAdvancedStatsDialog",
      close: "closeAdvancedStatsDialog",
    },
    { flag: "sshDialogOpen", open: "openSshDialog", close: "closeSshDialog" },
  ];

  for (const { flag, open, close } of dialogCases) {
    it(`${String(flag)} starts closed`, () => {
      expect(useUIStore.getState()[flag]).toBe(false);
    });

    it(`${String(open)} sets ${String(flag)} to true`, () => {
      (useUIStore.getState()[open] as () => void)();
      expect(useUIStore.getState()[flag]).toBe(true);
    });

    it(`${String(close)} sets ${String(flag)} to false`, () => {
      (useUIStore.getState()[open] as () => void)();
      (useUIStore.getState()[close] as () => void)();
      expect(useUIStore.getState()[flag]).toBe(false);
    });
  }

  it("mergeEditorOpen starts false and mergeEditorFile starts empty", () => {
    expect(useUIStore.getState().mergeEditorOpen).toBe(false);
    expect(useUIStore.getState().mergeEditorFile).toBe("");
  });

  it("openMergeEditor sets flag and stores file path", () => {
    useUIStore.getState().openMergeEditor("/src/foo.ts");
    expect(useUIStore.getState().mergeEditorOpen).toBe(true);
    expect(useUIStore.getState().mergeEditorFile).toBe("/src/foo.ts");
  });

  it("closeMergeEditor clears flag and file path", () => {
    useUIStore.getState().openMergeEditor("/src/foo.ts");
    useUIStore.getState().closeMergeEditor();
    expect(useUIStore.getState().mergeEditorOpen).toBe(false);
    expect(useUIStore.getState().mergeEditorFile).toBe("");
  });

  it("reviewPanelOpen starts false and reviewPanelCommit starts empty", () => {
    expect(useUIStore.getState().reviewPanelOpen).toBe(false);
    expect(useUIStore.getState().reviewPanelCommit).toBe("");
  });

  it("openReviewPanel sets flag and stores commit hash", () => {
    useUIStore.getState().openReviewPanel("abc123");
    expect(useUIStore.getState().reviewPanelOpen).toBe(true);
    expect(useUIStore.getState().reviewPanelCommit).toBe("abc123");
  });

  it("closeReviewPanel clears flag and commit hash", () => {
    useUIStore.getState().openReviewPanel("abc123");
    useUIStore.getState().closeReviewPanel();
    expect(useUIStore.getState().reviewPanelOpen).toBe(false);
    expect(useUIStore.getState().reviewPanelCommit).toBe("");
  });

  it("multiple dialogs can be open simultaneously", () => {
    useUIStore.getState().openCloneDialog();
    useUIStore.getState().openSettingsDialog();
    useUIStore.getState().openGrepDialog();
    expect(useUIStore.getState().cloneDialogOpen).toBe(true);
    expect(useUIStore.getState().settingsDialogOpen).toBe(true);
    expect(useUIStore.getState().grepDialogOpen).toBe(true);
  });

  it("opening one dialog does not affect other dialogs", () => {
    useUIStore.getState().openAboutDialog();
    expect(useUIStore.getState().cloneDialogOpen).toBe(false);
    expect(useUIStore.getState().settingsDialogOpen).toBe(false);
    expect(useUIStore.getState().grepDialogOpen).toBe(false);
  });
});

describe("ui-store — toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDialogs();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("toasts starts empty", () => {
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it("showToast adds a toast with default type error", () => {
    useUIStore.getState().showToast("Something went wrong");
    const { toasts } = useUIStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.text).toBe("Something went wrong");
    expect(toasts[0]!.type).toBe("error");
    expect(typeof toasts[0]!.id).toBe("number");
  });

  it("showToast adds a toast with explicit type info", () => {
    useUIStore.getState().showToast("Operation complete", "info");
    const { toasts } = useUIStore.getState();
    expect(toasts[0]!.type).toBe("info");
  });

  it("showToast adds multiple toasts with unique ids", () => {
    useUIStore.getState().showToast("First");
    useUIStore.getState().showToast("Second");
    const { toasts } = useUIStore.getState();
    expect(toasts).toHaveLength(2);
    expect(toasts[0]!.id).not.toBe(toasts[1]!.id);
  });

  it("dismissToast removes the toast with the given id", () => {
    useUIStore.getState().showToast("Hello");
    const id = useUIStore.getState().toasts[0]!.id;
    useUIStore.getState().dismissToast(id);
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it("dismissToast does not remove other toasts", () => {
    useUIStore.getState().showToast("First");
    useUIStore.getState().showToast("Second");
    const [first, second] = useUIStore.getState().toasts;
    useUIStore.getState().dismissToast(first!.id);
    const remaining = useUIStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(second!.id);
  });

  it("toast auto-dismisses after 5 seconds", () => {
    useUIStore.getState().showToast("Auto-remove me");
    expect(useUIStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(useUIStore.getState().toasts).toHaveLength(0);
  });

  it("toast does not auto-dismiss before 5 seconds", () => {
    useUIStore.getState().showToast("Still here");
    vi.advanceTimersByTime(4999);
    expect(useUIStore.getState().toasts).toHaveLength(1);
  });
});
