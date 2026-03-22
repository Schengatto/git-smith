import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mocks so they're available when vi.mock factory runs
const { setApplicationMenuMock, buildFromTemplateMock } = vi.hoisted(() => {
  const setApplicationMenuMock = vi.fn();
  const buildFromTemplateMock = vi.fn().mockReturnValue({ id: "mock-menu" });
  return { setApplicationMenuMock, buildFromTemplateMock };
});

vi.mock("electron", () => ({
  app: {
    name: "Git Expansion",
  },
  Menu: {
    setApplicationMenu: setApplicationMenuMock,
    buildFromTemplate: buildFromTemplateMock,
  },
}));

import { createMenu } from "./menu";

beforeEach(() => {
  vi.clearAllMocks();
  buildFromTemplateMock.mockReturnValue({ id: "mock-menu" });
});

describe("createMenu", () => {
  it("sets application menu to null on Windows", () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    createMenu();
    expect(setApplicationMenuMock).toHaveBeenCalledWith(null);
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });

  it("sets application menu to null on Linux", () => {
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    createMenu();
    expect(setApplicationMenuMock).toHaveBeenCalledWith(null);
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });

  it("does not call buildFromTemplate on Windows/Linux", () => {
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    createMenu();
    expect(buildFromTemplateMock).not.toHaveBeenCalled();
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });

  it("calls buildFromTemplate on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    createMenu();
    expect(buildFromTemplateMock).toHaveBeenCalled();
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });

  it("sets the built menu as application menu on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    createMenu();
    expect(setApplicationMenuMock).toHaveBeenCalledWith({ id: "mock-menu" });
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });

  it("macOS menu template includes app name submenu", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    createMenu();
    const template = buildFromTemplateMock.mock
      .calls[0]![0] as Electron.MenuItemConstructorOptions[];
    const appMenu = template.find((item) => item.label === "Git Expansion");
    expect(appMenu).toBeDefined();
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });

  it("macOS menu template includes Edit submenu", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    createMenu();
    const template = buildFromTemplateMock.mock
      .calls[0]![0] as Electron.MenuItemConstructorOptions[];
    const editMenu = template.find((item) => item.label === "Edit");
    expect(editMenu).toBeDefined();
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });

  it("macOS menu template includes View submenu", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    createMenu();
    const template = buildFromTemplateMock.mock
      .calls[0]![0] as Electron.MenuItemConstructorOptions[];
    const viewMenu = template.find((item) => item.label === "View");
    expect(viewMenu).toBeDefined();
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });

  it("macOS app submenu includes quit role", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    createMenu();
    const template = buildFromTemplateMock.mock
      .calls[0]![0] as Electron.MenuItemConstructorOptions[];
    const appMenu = template.find((item) => item.label === "Git Expansion")!;
    const submenu = appMenu.submenu as Electron.MenuItemConstructorOptions[];
    expect(submenu.some((item) => item.role === "quit")).toBe(true);
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });

  it("macOS edit submenu includes copy and paste roles", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    createMenu();
    const template = buildFromTemplateMock.mock
      .calls[0]![0] as Electron.MenuItemConstructorOptions[];
    const editMenu = template.find((item) => item.label === "Edit")!;
    const submenu = editMenu.submenu as Electron.MenuItemConstructorOptions[];
    expect(submenu.some((item) => item.role === "copy")).toBe(true);
    expect(submenu.some((item) => item.role === "paste")).toBe(true);
    Object.defineProperty(process, "platform", {
      value: process.platform,
      configurable: true,
    });
  });
});
