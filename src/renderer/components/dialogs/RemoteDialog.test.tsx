// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RemoteDialog } from "./RemoteDialog";

vi.mock("../../store/ui-store", () => ({
  useUIStore: Object.assign(
    (selector: (s: { showToast: ReturnType<typeof vi.fn> }) => unknown) =>
      selector({ showToast: vi.fn() }),
    { getState: () => ({ showToast: vi.fn() }), subscribe: () => () => {} }
  ),
}));

const mockRemotes = [
  {
    name: "origin",
    fetchUrl: "https://github.com/user/repo.git",
    pushUrl: "https://github.com/user/repo.git",
  },
  {
    name: "upstream",
    fetchUrl: "https://github.com/org/repo.git",
    pushUrl: "https://github.com/org/repo.git",
  },
];

const mockElectronAPI = {
  remote: {
    list: vi.fn().mockResolvedValue(mockRemotes),
    add: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockElectronAPI.remote.list.mockResolvedValue(mockRemotes);
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("RemoteDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<RemoteDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog title when open", () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Manage Remotes")).toBeInTheDocument();
  });

  it("calls remote.list on open", () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    expect(mockElectronAPI.remote.list).toHaveBeenCalledOnce();
  });

  it("renders remote names after loading", async () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(screen.getByText("origin")).toBeInTheDocument();
      expect(screen.getByText("upstream")).toBeInTheDocument();
    });
  });

  it("renders remote fetch URL after loading", async () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(screen.getByText("https://github.com/user/repo.git")).toBeInTheDocument();
    });
  });

  it("renders Add Remote button", () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Add Remote")).toBeInTheDocument();
  });

  it("renders Done button", () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("calls onClose when Done is clicked", () => {
    const onClose = vi.fn();
    render(<RemoteDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows add remote form with name and URL inputs when Add Remote is clicked", () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Add Remote"));
    expect(screen.getByPlaceholderText("origin")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("https://github.com/user/repo.git")).toBeInTheDocument();
  });

  it("shows Add and Cancel buttons inside the add form", () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Add Remote"));
    expect(screen.getByText("Add")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("hides add form when Cancel inside the form is clicked", () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Add Remote"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.queryByPlaceholderText("origin")).not.toBeInTheDocument();
    expect(screen.getByText("Add Remote")).toBeInTheDocument();
  });

  it("Add button is disabled when name or url is empty", () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Add Remote"));
    expect((screen.getByText("Add") as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls remote.add with correct name and url", async () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText("Add Remote"));
    fireEvent.change(screen.getByPlaceholderText("origin"), {
      target: { value: "newremote" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://github.com/user/repo.git"), {
      target: { value: "https://example.com/repo.git" },
    });
    fireEvent.click(screen.getByText("Add"));
    await vi.waitFor(() => {
      expect(mockElectronAPI.remote.add).toHaveBeenCalledWith(
        "newremote",
        "https://example.com/repo.git"
      );
    });
  });

  it("calls remote.remove when the delete button is clicked for a remote", async () => {
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => screen.getByText("origin"));
    const removeBtns = screen.getAllByTitle("Remove remote");
    fireEvent.click(removeBtns[0]!);
    await vi.waitFor(() => {
      expect(mockElectronAPI.remote.remove).toHaveBeenCalledWith("origin");
    });
  });

  it("shows empty state when no remotes are configured", async () => {
    mockElectronAPI.remote.list.mockResolvedValueOnce([]);
    render(<RemoteDialog open={true} onClose={vi.fn()} />);
    await vi.waitFor(() => {
      expect(screen.getByText("No remotes configured")).toBeInTheDocument();
    });
  });
});
