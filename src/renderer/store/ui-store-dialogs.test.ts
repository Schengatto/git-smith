import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock DOM APIs at top level before any import
// ui-store calls applyTheme() at module load time which uses document + localStorage
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

describe("UI Store - Dialog State", () => {
  beforeEach(() => {
    useUIStore.setState({
      cloneDialogOpen: false,
      settingsDialogOpen: false,
      scanDialogOpen: false,
    });
  });

  it("clone dialog starts closed", () => {
    expect(useUIStore.getState().cloneDialogOpen).toBe(false);
  });

  it("opens clone dialog", () => {
    useUIStore.getState().openCloneDialog();
    expect(useUIStore.getState().cloneDialogOpen).toBe(true);
  });

  it("closes clone dialog", () => {
    useUIStore.getState().openCloneDialog();
    useUIStore.getState().closeCloneDialog();
    expect(useUIStore.getState().cloneDialogOpen).toBe(false);
  });

  it("settings dialog starts closed", () => {
    expect(useUIStore.getState().settingsDialogOpen).toBe(false);
  });

  it("opens settings dialog", () => {
    useUIStore.getState().openSettingsDialog();
    expect(useUIStore.getState().settingsDialogOpen).toBe(true);
  });

  it("closes settings dialog", () => {
    useUIStore.getState().openSettingsDialog();
    useUIStore.getState().closeSettingsDialog();
    expect(useUIStore.getState().settingsDialogOpen).toBe(false);
  });

  it("scan dialog starts closed", () => {
    expect(useUIStore.getState().scanDialogOpen).toBe(false);
  });

  it("opens scan dialog", () => {
    useUIStore.getState().openScanDialog();
    expect(useUIStore.getState().scanDialogOpen).toBe(true);
  });

  it("closes scan dialog", () => {
    useUIStore.getState().openScanDialog();
    useUIStore.getState().closeScanDialog();
    expect(useUIStore.getState().scanDialogOpen).toBe(false);
  });

  it("opening one dialog does not affect others", () => {
    useUIStore.getState().openCloneDialog();
    expect(useUIStore.getState().cloneDialogOpen).toBe(true);
    expect(useUIStore.getState().settingsDialogOpen).toBe(false);
    expect(useUIStore.getState().scanDialogOpen).toBe(false);
  });

  it("multiple dialogs can be open simultaneously", () => {
    useUIStore.getState().openCloneDialog();
    useUIStore.getState().openSettingsDialog();
    expect(useUIStore.getState().cloneDialogOpen).toBe(true);
    expect(useUIStore.getState().settingsDialogOpen).toBe(true);
  });
});
