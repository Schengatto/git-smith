import { describe, it, expect, beforeEach, vi } from "vitest";
import type { GitAccount } from "../../shared/git-types";

const mockList = vi.fn();
const mockAdd = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockGetForRepo = vi.fn();
const mockSetForRepo = vi.fn();
const mockSetDefault = vi.fn();

vi.stubGlobal("window", {
  electronAPI: {
    account: {
      list: mockList,
      add: mockAdd,
      update: mockUpdate,
      delete: mockDelete,
      getForRepo: mockGetForRepo,
      setForRepo: mockSetForRepo,
      setDefault: mockSetDefault,
    },
  },
});

// crypto.randomUUID is available in Node 19+ but may not be in the test env
vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => "test-uuid-1234"),
});

import { useAccountStore } from "./account-store";

const makeAccount = (overrides: Partial<GitAccount> = {}): GitAccount => ({
  id: "acc-1",
  label: "Work",
  name: "Alice",
  email: "alice@example.com",
  ...overrides,
});

const resetStore = () => {
  useAccountStore.setState({ accounts: [], currentAccount: null });
};

describe("account-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  describe("initial state", () => {
    it("accounts starts empty", () => {
      expect(useAccountStore.getState().accounts).toEqual([]);
    });

    it("currentAccount starts null", () => {
      expect(useAccountStore.getState().currentAccount).toBeNull();
    });
  });

  describe("loadAccounts", () => {
    it("fetches accounts from API and stores them", async () => {
      const accounts = [makeAccount()];
      mockList.mockResolvedValue(accounts);
      await useAccountStore.getState().loadAccounts();
      expect(useAccountStore.getState().accounts).toEqual(accounts);
    });

    it("calls account.list once", async () => {
      mockList.mockResolvedValue([]);
      await useAccountStore.getState().loadAccounts();
      expect(mockList).toHaveBeenCalledOnce();
    });

    it("replaces previous accounts list", async () => {
      useAccountStore.setState({ accounts: [makeAccount({ id: "old" })] });
      const fresh = [makeAccount({ id: "new", label: "Personal" })];
      mockList.mockResolvedValue(fresh);
      await useAccountStore.getState().loadAccounts();
      expect(useAccountStore.getState().accounts).toEqual(fresh);
    });
  });

  describe("addAccount", () => {
    it("calls account.add with a generated id", async () => {
      mockAdd.mockResolvedValue(undefined);
      mockList.mockResolvedValue([]);
      const data = { label: "Work", name: "Alice", email: "alice@example.com" };
      await useAccountStore.getState().addAccount(data);
      expect(mockAdd).toHaveBeenCalledOnce();
      const called = mockAdd.mock.calls[0]![0] as GitAccount;
      expect(called.label).toBe("Work");
      expect(called.name).toBe("Alice");
      expect(called.email).toBe("alice@example.com");
      expect(typeof called.id).toBe("string");
      expect(called.id.length).toBeGreaterThan(0);
    });

    it("reloads accounts after adding", async () => {
      const newAccount = makeAccount({ id: "test-uuid-1234" });
      mockAdd.mockResolvedValue(undefined);
      mockList.mockResolvedValue([newAccount]);
      await useAccountStore
        .getState()
        .addAccount({ label: "Work", name: "Alice", email: "alice@example.com" });
      expect(mockList).toHaveBeenCalledOnce();
      expect(useAccountStore.getState().accounts).toEqual([newAccount]);
    });
  });

  describe("updateAccount", () => {
    it("calls account.update with id and partial data", async () => {
      mockUpdate.mockResolvedValue(undefined);
      mockList.mockResolvedValue([]);
      await useAccountStore.getState().updateAccount("acc-1", { name: "Bob" });
      expect(mockUpdate).toHaveBeenCalledWith("acc-1", { name: "Bob" });
    });

    it("reloads accounts after updating", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const updated = [makeAccount({ name: "Bob" })];
      mockList.mockResolvedValue(updated);
      await useAccountStore.getState().updateAccount("acc-1", { name: "Bob" });
      expect(useAccountStore.getState().accounts).toEqual(updated);
    });

    it("refreshes currentAccount if the updated account is current", async () => {
      const original = makeAccount({ id: "acc-1", name: "Alice" });
      useAccountStore.setState({ accounts: [original], currentAccount: original });
      mockUpdate.mockResolvedValue(undefined);
      mockList.mockResolvedValue([{ ...original, name: "Alice Updated" }]);
      await useAccountStore.getState().updateAccount("acc-1", { name: "Alice Updated" });
      expect(useAccountStore.getState().currentAccount?.name).toBe("Alice Updated");
    });

    it("does not change currentAccount if a different account is updated", async () => {
      const current = makeAccount({ id: "acc-1" });
      useAccountStore.setState({ accounts: [current], currentAccount: current });
      mockUpdate.mockResolvedValue(undefined);
      mockList.mockResolvedValue([current]);
      await useAccountStore.getState().updateAccount("acc-2", { name: "Other" });
      expect(useAccountStore.getState().currentAccount?.id).toBe("acc-1");
    });
  });

  describe("deleteAccount", () => {
    it("calls account.delete with the given id", async () => {
      mockDelete.mockResolvedValue(undefined);
      mockList.mockResolvedValue([]);
      await useAccountStore.getState().deleteAccount("acc-1");
      expect(mockDelete).toHaveBeenCalledWith("acc-1");
    });

    it("reloads accounts after deletion", async () => {
      mockDelete.mockResolvedValue(undefined);
      mockList.mockResolvedValue([]);
      await useAccountStore.getState().deleteAccount("acc-1");
      expect(mockList).toHaveBeenCalledOnce();
    });

    it("clears currentAccount if the deleted account was current", async () => {
      const current = makeAccount({ id: "acc-1" });
      useAccountStore.setState({ accounts: [current], currentAccount: current });
      mockDelete.mockResolvedValue(undefined);
      mockList.mockResolvedValue([]);
      await useAccountStore.getState().deleteAccount("acc-1");
      expect(useAccountStore.getState().currentAccount).toBeNull();
    });

    it("does not clear currentAccount if a different account is deleted", async () => {
      const current = makeAccount({ id: "acc-1" });
      const other = makeAccount({ id: "acc-2" });
      useAccountStore.setState({ accounts: [current, other], currentAccount: current });
      mockDelete.mockResolvedValue(undefined);
      mockList.mockResolvedValue([current]);
      await useAccountStore.getState().deleteAccount("acc-2");
      expect(useAccountStore.getState().currentAccount?.id).toBe("acc-1");
    });
  });

  describe("loadCurrentAccount", () => {
    it("fetches the account for the given repo path", async () => {
      const account = makeAccount();
      mockGetForRepo.mockResolvedValue(account);
      await useAccountStore.getState().loadCurrentAccount("/repo/path");
      expect(mockGetForRepo).toHaveBeenCalledWith("/repo/path");
      expect(useAccountStore.getState().currentAccount).toEqual(account);
    });

    it("sets currentAccount to null when no account is found", async () => {
      mockGetForRepo.mockResolvedValue(null);
      await useAccountStore.getState().loadCurrentAccount("/repo/path");
      expect(useAccountStore.getState().currentAccount).toBeNull();
    });
  });

  describe("setAccountForRepo", () => {
    it("calls account.setForRepo with the repo path and account id", async () => {
      const accounts = [makeAccount({ id: "acc-1" })];
      useAccountStore.setState({ accounts });
      mockSetForRepo.mockResolvedValue(undefined);
      await useAccountStore.getState().setAccountForRepo("/repo/path", "acc-1");
      expect(mockSetForRepo).toHaveBeenCalledWith("/repo/path", "acc-1");
    });

    it("sets currentAccount to the matched account when accountId is provided", async () => {
      const account = makeAccount({ id: "acc-1" });
      useAccountStore.setState({ accounts: [account], currentAccount: null });
      mockSetForRepo.mockResolvedValue(undefined);
      await useAccountStore.getState().setAccountForRepo("/repo/path", "acc-1");
      expect(useAccountStore.getState().currentAccount).toEqual(account);
    });

    it("sets currentAccount to null when accountId is null", async () => {
      const account = makeAccount({ id: "acc-1" });
      useAccountStore.setState({ accounts: [account], currentAccount: account });
      mockSetForRepo.mockResolvedValue(undefined);
      await useAccountStore.getState().setAccountForRepo("/repo/path", null);
      expect(useAccountStore.getState().currentAccount).toBeNull();
    });

    it("sets currentAccount to null if the accountId does not match any account", async () => {
      useAccountStore.setState({ accounts: [], currentAccount: null });
      mockSetForRepo.mockResolvedValue(undefined);
      await useAccountStore.getState().setAccountForRepo("/repo/path", "nonexistent");
      expect(useAccountStore.getState().currentAccount).toBeNull();
    });
  });

  describe("setDefaultAccount", () => {
    it("calls account.setDefault with the given accountId", async () => {
      mockSetDefault.mockResolvedValue(undefined);
      await useAccountStore.getState().setDefaultAccount("acc-1");
      expect(mockSetDefault).toHaveBeenCalledWith("acc-1");
    });

    it("calls account.setDefault with null to clear the default", async () => {
      mockSetDefault.mockResolvedValue(undefined);
      await useAccountStore.getState().setDefaultAccount(null);
      expect(mockSetDefault).toHaveBeenCalledWith(null);
    });
  });
});
