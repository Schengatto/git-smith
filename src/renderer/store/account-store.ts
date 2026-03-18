import { create } from "zustand";
import type { GitAccount } from "../../shared/git-types";

interface AccountState {
  accounts: GitAccount[];
  currentAccount: GitAccount | null;
  loadAccounts: () => Promise<void>;
  addAccount: (account: Omit<GitAccount, "id">) => Promise<void>;
  updateAccount: (id: string, partial: Partial<GitAccount>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  loadCurrentAccount: (repoPath: string) => Promise<void>;
  setAccountForRepo: (repoPath: string, accountId: string | null) => Promise<void>;
  setDefaultAccount: (accountId: string | null) => Promise<void>;
}

export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  currentAccount: null,

  loadAccounts: async () => {
    const accounts = await window.electronAPI.account.list();
    set({ accounts });
  },

  addAccount: async (data) => {
    const account: GitAccount = {
      ...data,
      id: crypto.randomUUID(),
    };
    await window.electronAPI.account.add(account);
    await get().loadAccounts();
  },

  updateAccount: async (id, partial) => {
    await window.electronAPI.account.update(id, partial);
    await get().loadAccounts();
    // Refresh current account if it was updated
    const { currentAccount } = get();
    if (currentAccount?.id === id) {
      set({ currentAccount: { ...currentAccount, ...partial, id } });
    }
  },

  deleteAccount: async (id) => {
    await window.electronAPI.account.delete(id);
    await get().loadAccounts();
    const { currentAccount } = get();
    if (currentAccount?.id === id) {
      set({ currentAccount: null });
    }
  },

  loadCurrentAccount: async (repoPath) => {
    const account = await window.electronAPI.account.getForRepo(repoPath);
    set({ currentAccount: account });
  },

  setAccountForRepo: async (repoPath, accountId) => {
    await window.electronAPI.account.setForRepo(repoPath, accountId);
    if (accountId) {
      const accounts = get().accounts;
      set({ currentAccount: accounts.find((a) => a.id === accountId) || null });
    } else {
      set({ currentAccount: null });
    }
  },

  setDefaultAccount: async (accountId) => {
    await window.electronAPI.account.setDefault(accountId);
  },
}));
