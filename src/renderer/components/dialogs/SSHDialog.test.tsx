// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { SSHDialog } from "./SSHDialog";

const mockElectronAPI = {
  ssh: {
    list: vi.fn().mockResolvedValue([]),
    generate: vi.fn().mockResolvedValue("ssh-ed25519 AAAA..."),
    getPublic: vi.fn().mockResolvedValue("ssh-ed25519 AAAA..."),
    test: vi.fn().mockResolvedValue("Hi user! You have authenticated."),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
  (window as unknown as { electronAPI: typeof mockElectronAPI }).electronAPI = mockElectronAPI;
});

describe("SSHDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<SSHDialog open={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders the dialog title when open", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("SSH Key Manager")).toBeInTheDocument();
  });

  it("shows SSH Keys section header", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("SSH Keys")).toBeInTheDocument();
  });

  it("shows Generate New Key section", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Generate New Key")).toBeInTheDocument();
  });

  it("shows Test Connection section", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Test Connection")).toBeInTheDocument();
  });

  it("shows empty state message when no SSH keys found", async () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/no ssh keys found/i)).toBeInTheDocument();
    });
  });

  it("renders key type buttons (ed25519 and rsa)", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /ed25519/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rsa/i })).toBeInTheDocument();
  });

  it("shows Comment and Filename inputs", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("id_ed25519")).toBeInTheDocument();
  });

  it("changes filename to id_rsa when RSA key type is selected", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /rsa/i }));
    expect(screen.getByDisplayValue("id_rsa")).toBeInTheDocument();
  });

  it("shows Generate Key button", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /generate key/i })).toBeInTheDocument();
  });

  it("shows Test button with default host git@github.com", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^test$/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("git@github.com")).toBeInTheDocument();
  });

  it("renders existing SSH keys when list returns data", async () => {
    mockElectronAPI.ssh.list.mockResolvedValue([
      {
        name: "id_ed25519",
        type: "ed25519",
        path: "/home/user/.ssh/id_ed25519",
        fingerprint: "SHA256:abc123",
        hasPublicKey: true,
      },
    ]);
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("id_ed25519")).toBeInTheDocument();
    });
  });

  it("calls onClose when Close button is clicked", () => {
    const onClose = vi.fn();
    render(<SSHDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls ssh.test when Test button is clicked", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^test$/i }));
    expect(mockElectronAPI.ssh.test).toHaveBeenCalledWith("git@github.com");
  });

  it("shows test result when ssh.test resolves", async () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^test$/i }));
    await waitFor(() => {
      expect(screen.getByText("Hi user! You have authenticated.")).toBeInTheDocument();
    });
  });

  it("shows error when ssh.test rejects", async () => {
    mockElectronAPI.ssh.test.mockRejectedValue(new Error("Connection refused"));
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /^test$/i }));
    await waitFor(() => {
      expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });
  });

  it("calls ssh.generate when Generate Key is clicked", async () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate key/i }));
    await waitFor(() => {
      expect(mockElectronAPI.ssh.generate).toHaveBeenCalledWith("ed25519", "", "", "id_ed25519");
    });
  });

  it("shows generated public key after generation", async () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate key/i }));
    await waitFor(() => {
      expect(screen.getByText("Public Key (generated)")).toBeInTheDocument();
    });
  });

  it("shows generate error when ssh.generate rejects", async () => {
    mockElectronAPI.ssh.generate.mockRejectedValue(new Error("Key already exists"));
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /generate key/i }));
    await waitFor(() => {
      expect(screen.getByText("Key already exists")).toBeInTheDocument();
    });
  });

  it("does not change filename when it has been manually edited and key type changes", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    // Manually edit the filename
    const filenameInput = screen.getByDisplayValue("id_ed25519");
    fireEvent.change(filenameInput, { target: { value: "my_custom_key" } });
    // Switch to RSA — filename should NOT change since it was manually edited
    fireEvent.click(screen.getByRole("button", { name: /rsa/i }));
    expect(screen.getByDisplayValue("my_custom_key")).toBeInTheDocument();
  });

  it("shows loading state message when keys are loading", () => {
    mockElectronAPI.ssh.list.mockReturnValue(new Promise(() => {})); // never resolves
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Loading keys...")).toBeInTheDocument();
  });

  it("shows error when ssh.list rejects", async () => {
    mockElectronAPI.ssh.list.mockRejectedValue(new Error("Permission denied"));
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });

  it("shows Copy public key button for key with public key", async () => {
    mockElectronAPI.ssh.list.mockResolvedValue([
      {
        name: "id_ed25519",
        type: "ed25519",
        path: "/home/user/.ssh/id_ed25519",
        fingerprint: "SHA256:abc123",
        hasPublicKey: true,
      },
    ]);
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Copy public key")).toBeInTheDocument();
    });
  });

  it("does not show Copy public key button when hasPublicKey is false", async () => {
    mockElectronAPI.ssh.list.mockResolvedValue([
      {
        name: "id_rsa",
        type: "rsa",
        path: "/home/user/.ssh/id_rsa",
        fingerprint: "SHA256:def456",
        hasPublicKey: false,
      },
    ]);
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("id_rsa")).toBeInTheDocument();
    });
    expect(screen.queryByText("Copy public key")).not.toBeInTheDocument();
  });

  it("shows fingerprint in the key card", async () => {
    mockElectronAPI.ssh.list.mockResolvedValue([
      {
        name: "id_ed25519",
        type: "ed25519",
        path: "/home/user/.ssh/id_ed25519",
        fingerprint: "SHA256:abc123",
        hasPublicKey: true,
      },
    ]);
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("SHA256:abc123")).toBeInTheDocument();
    });
  });

  it("shows 'No fingerprint available' when fingerprint is empty", async () => {
    mockElectronAPI.ssh.list.mockResolvedValue([
      {
        name: "id_ed25519",
        type: "ed25519",
        path: "/home/user/.ssh/id_ed25519",
        fingerprint: "",
        hasPublicKey: false,
      },
    ]);
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("No fingerprint available")).toBeInTheDocument();
    });
  });

  it("updates host input when typed", () => {
    render(<SSHDialog open={true} onClose={vi.fn()} />);
    const hostInput = screen.getByDisplayValue("git@github.com");
    fireEvent.change(hostInput, { target: { value: "git@gitlab.com" } });
    expect(screen.getByDisplayValue("git@gitlab.com")).toBeInTheDocument();
  });

  it("resets state when dialog re-opens", async () => {
    const { rerender } = render(<SSHDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.ssh.list).toHaveBeenCalledOnce());
    rerender(<SSHDialog open={false} onClose={vi.fn()} />);
    rerender(<SSHDialog open={true} onClose={vi.fn()} />);
    await waitFor(() => expect(mockElectronAPI.ssh.list).toHaveBeenCalledTimes(2));
  });
});
