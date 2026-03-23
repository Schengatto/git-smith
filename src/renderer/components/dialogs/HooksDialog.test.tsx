// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HooksDialog } from "./HooksDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        "hooks.title": "Git Hooks Manager",
        "hooks.noHooks": "No hooks found",
        "hooks.selectHookPrompt": "Select a hook from the list to view or edit its content",
        "hooks.active": "active",
        "hooks.inactive": "inactive",
        "hooks.noContent": "no content",
        "hooks.enable": "Enable",
        "hooks.disable": "Disable",
        "hooks.deleteHook": "Delete hook",
        "hooks.deleteHookConfirm": `Delete hook "${opts?.name ?? ""}"? This action cannot be undone.`,
        "hooks.saveContentFirst": "Save content first to enable this hook",
        "hooks.disableHook": "Disable hook",
        "hooks.enableHook": "Enable hook",
        "hooks.saving": "Saving...",
        "dialogs.loading": "Loading...",
        "dialogs.close": "Close",
        "dialogs.save": "Save",
        "dialogs.delete": "Delete",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

const mockHooks = [
  { name: "pre-commit", content: "#!/bin/sh\nexit 0", active: true },
  { name: "commit-msg", content: "", active: false },
];

const mockElectronAPI = {
  hooks: {
    list: vi.fn().mockResolvedValue(mockHooks),
    toggle: vi.fn().mockResolvedValue(undefined),
    write: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.hooks.list.mockResolvedValue(mockHooks);
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("HooksDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<HooksDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<HooksDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Git Hooks Manager")).toBeInTheDocument();
  });

  it("calls hooks.list when opened", () => {
    render(<HooksDialog open={true} onClose={vi.fn()} />);
    expect(mockElectronAPI.hooks.list).toHaveBeenCalledOnce();
  });

  it("renders hook names after loading", async () => {
    render(<HooksDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(screen.getByText("pre-commit")).toBeInTheDocument();
    });
  });

  it("renders placeholder text when no hook is selected", async () => {
    render(<HooksDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(
        screen.getByText("Select a hook from the list to view or edit its content")
      ).toBeInTheDocument();
    });
  });

  it("renders Close button", () => {
    render(<HooksDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("calls onClose when Close is clicked", () => {
    const onClose = vi.fn();
    render(<HooksDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the hook editor panel with Save button when a hook is selected", async () => {
    render(<HooksDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => screen.getByText("pre-commit"));
    fireEvent.click(screen.getByText("pre-commit"));
    await vi.waitFor(() => {
      expect(screen.getByText("Save")).toBeInTheDocument();
    });
  });

  it("shows Disable button for an active hook with content", async () => {
    render(<HooksDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => screen.getByText("pre-commit"));
    fireEvent.click(screen.getByText("pre-commit"));
    await vi.waitFor(() => {
      expect(screen.getByText("Disable")).toBeInTheDocument();
    });
  });

  it("calls hooks.write when Save is clicked", async () => {
    render(<HooksDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => screen.getByText("pre-commit"));
    fireEvent.click(screen.getByText("pre-commit"));
    await vi.waitFor(() => screen.getByText("Save"));
    fireEvent.click(screen.getByText("Save"));
    await vi.waitFor(() => {
      expect(mockElectronAPI.hooks.write).toHaveBeenCalledWith("pre-commit", expect.any(String));
    });
  });

  it("calls hooks.toggle when Disable is clicked", async () => {
    render(<HooksDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => screen.getByText("pre-commit"));
    fireEvent.click(screen.getByText("pre-commit"));
    await vi.waitFor(() => screen.getByText("Disable"));
    fireEvent.click(screen.getByText("Disable"));
    await vi.waitFor(() => {
      expect(mockElectronAPI.hooks.toggle).toHaveBeenCalledWith("pre-commit");
    });
  });
});
