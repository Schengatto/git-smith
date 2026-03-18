import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import os from "os";
import fs from "fs";
import path from "path";

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "store-accounts-test-"));

// Mock electron app with unique directory to avoid conflicts with other store tests
vi.mock("electron", () => ({
  app: {
    getPath: () => testDir,
  },
}));

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

import {
  getGitAccounts,
  addGitAccount,
  updateGitAccount,
  deleteGitAccount,
  getRepoAccount,
  setRepoAccount,
  getDefaultAccountId,
  setDefaultAccountId,
} from "./store";
import type { GitAccount } from "../shared/git-types";

describe("Git Accounts store", () => {
  const account1: GitAccount = {
    id: "test-acc-1",
    label: "Work",
    name: "John Work",
    email: "john@work.com",
  };
  const account2: GitAccount = {
    id: "test-acc-2",
    label: "Personal",
    name: "John Doe",
    email: "john@personal.com",
    sshKeyPath: "/home/john/.ssh/id_ed25519",
  };

  beforeEach(() => {
    // Clean up any previous accounts
    const accounts = getGitAccounts();
    for (const a of accounts) {
      deleteGitAccount(a.id);
    }
    setDefaultAccountId(null);
  });

  it("starts with empty accounts", () => {
    expect(getGitAccounts()).toEqual([]);
  });

  it("adds an account", () => {
    addGitAccount(account1);
    const accounts = getGitAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toEqual(account1);
  });

  it("adds multiple accounts", () => {
    addGitAccount(account1);
    addGitAccount(account2);
    expect(getGitAccounts()).toHaveLength(2);
  });

  it("updates an account", () => {
    addGitAccount(account1);
    updateGitAccount("test-acc-1", { label: "Office", email: "john@office.com" });
    const updated = getGitAccounts().find((a) => a.id === "test-acc-1");
    expect(updated?.label).toBe("Office");
    expect(updated?.email).toBe("john@office.com");
    expect(updated?.name).toBe("John Work"); // unchanged
  });

  it("deletes an account", () => {
    addGitAccount(account1);
    addGitAccount(account2);
    deleteGitAccount("test-acc-1");
    const accounts = getGitAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("test-acc-2");
  });

  it("cleans up repo mappings when account is deleted", () => {
    addGitAccount(account1);
    setRepoAccount("/repo/a", "test-acc-1");
    expect(getRepoAccount("/repo/a")).toBe("test-acc-1");
    deleteGitAccount("test-acc-1");
    expect(getRepoAccount("/repo/a")).toBeNull();
  });

  it("cleans up default when account is deleted", () => {
    addGitAccount(account1);
    setDefaultAccountId("test-acc-1");
    expect(getDefaultAccountId()).toBe("test-acc-1");
    deleteGitAccount("test-acc-1");
    expect(getDefaultAccountId()).toBeNull();
  });

  it("sets and gets repo account mapping", () => {
    setRepoAccount("/repo/a", "test-acc-1");
    expect(getRepoAccount("/repo/a")).toBe("test-acc-1");
  });

  it("removes repo account mapping with null", () => {
    setRepoAccount("/repo/a", "test-acc-1");
    setRepoAccount("/repo/a", null);
    expect(getRepoAccount("/repo/a")).toBeNull();
  });

  it("sets and gets default account id", () => {
    setDefaultAccountId("test-acc-2");
    expect(getDefaultAccountId()).toBe("test-acc-2");
    setDefaultAccountId(null);
    expect(getDefaultAccountId()).toBeNull();
  });
});
