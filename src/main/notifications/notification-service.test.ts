import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNotification = vi.fn();
const mockGetAllWindows = vi.fn();
vi.mock("electron", () => ({
  Notification: class {
    constructor(opts: unknown) {
      mockNotification(opts);
    }
    on() {
      return this;
    }
    show() {}
  },
  BrowserWindow: { getAllWindows: () => mockGetAllWindows() },
}));

const mockGetSettings = vi.fn();
vi.mock("../store", () => ({
  getSettings: () => mockGetSettings(),
}));

import { showNotification } from "./notification-service";

describe("notification-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllWindows.mockReturnValue([{ isFocused: () => false }]);
  });

  it("shows notification when enabled and window not focused", () => {
    mockGetSettings.mockReturnValue({
      notifications: { enabled: true, onFetch: true, onPush: true, onError: true },
    });
    showNotification("Test", "body", "fetch");
    expect(mockNotification).toHaveBeenCalledWith({
      title: "Test",
      body: "body",
      silent: false,
    });
  });

  it("does not show notification when disabled", () => {
    mockGetSettings.mockReturnValue({
      notifications: { enabled: false, onFetch: true, onPush: true, onError: true },
    });
    showNotification("Test", "body", "fetch");
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it("does not show fetch notification when onFetch is false", () => {
    mockGetSettings.mockReturnValue({
      notifications: { enabled: true, onFetch: false, onPush: true, onError: true },
    });
    showNotification("Test", "body", "fetch");
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it("does not show when window is focused", () => {
    mockGetSettings.mockReturnValue({
      notifications: { enabled: true, onFetch: true, onPush: true, onError: true },
    });
    mockGetAllWindows.mockReturnValue([{ isFocused: () => true }]);
    showNotification("Test", "body", "push");
    expect(mockNotification).not.toHaveBeenCalled();
  });

  it("shows push notification", () => {
    mockGetSettings.mockReturnValue({
      notifications: { enabled: true, onFetch: true, onPush: true, onError: true },
    });
    showNotification("Push", "ok", "push");
    expect(mockNotification).toHaveBeenCalled();
  });

  it("shows error notification", () => {
    mockGetSettings.mockReturnValue({
      notifications: { enabled: true, onFetch: true, onPush: true, onError: true },
    });
    showNotification("Error", "fail", "error");
    expect(mockNotification).toHaveBeenCalled();
  });
});
