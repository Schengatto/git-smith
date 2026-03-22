import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "./workspace-store";

describe("workspace-store", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ tabs: [], activeTabId: null });
  });

  it("adds a tab and sets it active", () => {
    const id = useWorkspaceStore.getState().addTab("/path/repo", "repo");
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1);
    expect(useWorkspaceStore.getState().activeTabId).toBe(id);
  });

  it("does not duplicate tabs for same path", () => {
    const id1 = useWorkspaceStore.getState().addTab("/path/repo", "repo");
    const id2 = useWorkspaceStore.getState().addTab("/path/repo", "repo");
    expect(id1).toBe(id2);
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1);
  });

  it("removes a tab", () => {
    const id = useWorkspaceStore.getState().addTab("/path/repo", "repo");
    useWorkspaceStore.getState().removeTab(id);
    expect(useWorkspaceStore.getState().tabs).toHaveLength(0);
    expect(useWorkspaceStore.getState().activeTabId).toBeNull();
  });

  it("switches active tab on remove", () => {
    const id1 = useWorkspaceStore.getState().addTab("/path/a", "a");
    useWorkspaceStore.getState().addTab("/path/b", "b");
    useWorkspaceStore.getState().setActiveTab(id1);
    useWorkspaceStore.getState().removeTab(id1);
    expect(useWorkspaceStore.getState().activeTabId).not.toBe(id1);
    expect(useWorkspaceStore.getState().tabs).toHaveLength(1);
  });

  it("updates tab properties", () => {
    const id = useWorkspaceStore.getState().addTab("/path/repo", "repo");
    useWorkspaceStore.getState().updateTab(id, { isDirty: true });
    expect(useWorkspaceStore.getState().tabs[0]!.isDirty).toBe(true);
  });

  it("moves tabs", () => {
    useWorkspaceStore.getState().addTab("/path/a", "a");
    useWorkspaceStore.getState().addTab("/path/b", "b");
    useWorkspaceStore.getState().moveTab(0, 1);
    expect(useWorkspaceStore.getState().tabs[0]!.repoName).toBe("b");
    expect(useWorkspaceStore.getState().tabs[1]!.repoName).toBe("a");
  });

  it("getActiveTab returns the active tab", () => {
    useWorkspaceStore.getState().addTab("/path/repo", "repo");
    const tab = useWorkspaceStore.getState().getActiveTab();
    expect(tab).not.toBeNull();
    expect(tab!.repoPath).toBe("/path/repo");
  });
});
