// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("./dialogs/MergeConflictDialog", () => ({
  MergeConflictDialog: (props: Record<string, unknown>) => (
    <div data-testid="merge-conflict-dialog" data-mode={props.mode as string}>MergeConflictDialog</div>
  ),
}));
vi.mock("./dialogs/CommitInfoWindow", () => ({
  CommitInfoWindow: (props: Record<string, unknown>) => (
    <div data-testid="commit-info-window" data-mode={props.mode as string}>CommitInfoWindow</div>
  ),
}));
vi.mock("./dialogs/StashDialog", () => ({
  StashDialog: (props: Record<string, unknown>) => (
    <div data-testid="stash-dialog" data-mode={props.mode as string}>StashDialog</div>
  ),
}));
vi.mock("./dialogs/SettingsDialog", () => ({
  SettingsDialog: (props: Record<string, unknown>) => (
    <div data-testid="settings-dialog" data-mode={props.mode as string}>SettingsDialog</div>
  ),
}));
vi.mock("./dialogs/InteractiveRebaseDialog", () => ({
  InteractiveRebaseDialog: (props: Record<string, unknown>) => (
    <div data-testid="interactive-rebase-dialog" data-mode={props.mode as string}>InteractiveRebaseDialog</div>
  ),
}));

import { DialogRouter } from "./DialogRouter";

const getInitDataMock = vi.fn().mockResolvedValue(undefined);
const sendResultMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getInitDataMock.mockResolvedValue(undefined);
  (window as unknown as { electronAPI: Record<string, unknown> }).electronAPI = {
    dialog: {
      getInitData: getInitDataMock,
      sendResult: sendResultMock,
    },
  };
});

describe("DialogRouter", () => {
  it("renders MergeConflictDialog for matching name", async () => {
    render(<DialogRouter dialog="MergeConflictDialog" />);
    const el = await screen.findByTestId("merge-conflict-dialog");
    expect(el).toBeDefined();
    expect(el.dataset.mode).toBe("window");
  });

  it("renders CommitInfoWindow for matching name", async () => {
    render(<DialogRouter dialog="CommitInfoWindow" />);
    expect(await screen.findByTestId("commit-info-window")).toBeDefined();
  });

  it("renders StashDialog for matching name", async () => {
    render(<DialogRouter dialog="StashDialog" />);
    expect(await screen.findByTestId("stash-dialog")).toBeDefined();
  });

  it("renders SettingsDialog for matching name", async () => {
    render(<DialogRouter dialog="SettingsDialog" />);
    expect(await screen.findByTestId("settings-dialog")).toBeDefined();
  });

  it("renders InteractiveRebaseDialog for matching name", async () => {
    render(<DialogRouter dialog="InteractiveRebaseDialog" />);
    expect(await screen.findByTestId("interactive-rebase-dialog")).toBeDefined();
  });

  it("shows error for unknown dialog name", async () => {
    render(<DialogRouter dialog="UnknownDialog" />);
    expect(await screen.findByText(/unknown dialog/i)).toBeDefined();
  });
});
