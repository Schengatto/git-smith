# Delete Remote Tag

## Summary

Add the ability to delete a tag from the remote when deleting it locally. A checkbox "Delete tag from remote" is added to the existing delete-tag confirmation dialogs (Sidebar and CommitGraphPanel).

## Changes

### 1. Backend — `src/main/git/git-service.ts`

New method:

```typescript
async deleteRemoteTag(name: string, remote = "origin"): Promise<void> {
  const git = this.ensureRepo();
  await this.run("git push --delete tag", [remote, "--delete", `refs/tags/${name}`], () =>
    git.push(remote, ["--delete", `refs/tags/${name}`])
  );
}
```

### 2. Shared — `src/shared/ipc-channels.ts`

Add `DELETE_REMOTE` to the `TAG` block:

```typescript
TAG: {
  LIST: "git:tag:list",
  CREATE: "git:tag:create",
  DELETE: "git:tag:delete",
  DELETE_REMOTE: "git:tag:delete-remote",
  PUSH: "git:tag:push",
}
```

### 3. IPC Handler — `src/main/ipc/git-branch.ipc.ts`

New handler:

```typescript
ipcMain.handle(IPC.TAG.DELETE_REMOTE, async (_event, name: string, remote?: string) => {
  await gitService.deleteRemoteTag(name, remote);
});
```

### 4. Preload — `src/preload/index.ts`

Expose in the `tag` namespace:

```typescript
deleteRemote: (name: string, remote?: string): Promise<void> =>
  ipcRenderer.invoke(IPC.TAG.DELETE_REMOTE, name, remote),
```

### 5. UI — Confirmation Dialogs

Both Sidebar and CommitGraphPanel delete-tag dialogs get:

- A checkbox labeled **"Delete tag from remote"** (unchecked by default)
- On confirm: calls `tag.delete(name)` first, then conditionally `tag.deleteRemote(name)` if checked

### 6. Tests

- Unit test for `deleteRemoteTag` in git-service
- Unit test for IPC handler registration

## Out of Scope

- Standalone "Delete Remote Tag" context menu entry
- Selecting which remote to delete from (defaults to "origin")
