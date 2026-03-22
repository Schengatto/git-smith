// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { IssueLinkText } from "./IssueLink";

const resolveIssueMock = vi.fn();
const openFileMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as Record<string, unknown>).electronAPI = {
    issues: {
      resolve: resolveIssueMock,
    },
    shell: {
      openFile: openFileMock,
    },
  };
});

describe("IssueLinkText", () => {
  it("renders plain text when no issue references are present", () => {
    resolveIssueMock.mockResolvedValue(null);
    const { container } = render(<IssueLinkText text="Just a plain commit message" />);
    expect(container.textContent).toBe("Just a plain commit message");
  });

  it("renders issue reference as a styled span", async () => {
    resolveIssueMock.mockResolvedValue(null);
    const { container } = render(<IssueLinkText text="Fix #42 in codebase" />);
    expect(screen.getByText("#42")).toBeInTheDocument();
    // Plain text parts are text nodes — check container text content
    expect(container.textContent).toContain("Fix ");
    expect(container.textContent).toContain(" in codebase");
  });

  it("renders multiple issue references", async () => {
    resolveIssueMock.mockResolvedValue(null);
    render(<IssueLinkText text="Closes #10 and #20" />);
    expect(screen.getByText("#10")).toBeInTheDocument();
    expect(screen.getByText("#20")).toBeInTheDocument();
  });

  it("calls electronAPI.issues.resolve for each issue reference", async () => {
    resolveIssueMock.mockResolvedValue(null);
    render(<IssueLinkText text="Fix #42" />);
    await waitFor(() => {
      expect(resolveIssueMock).toHaveBeenCalledWith("#42");
    });
  });

  it("shows loading title while resolving issue info", async () => {
    let resolveFn!: (v: null) => void;
    resolveIssueMock.mockReturnValue(
      new Promise((res) => {
        resolveFn = res;
      })
    );
    render(<IssueLinkText text="Fix #42" />);
    await waitFor(() => {
      expect(screen.getByTitle("Loading...")).toBeInTheDocument();
    });
    resolveFn(null);
  });

  it("shows issue title and state as tooltip when info is resolved", async () => {
    resolveIssueMock.mockResolvedValue({
      number: 42,
      title: "Bug fix",
      state: "open",
      url: "https://github.com/org/repo/issues/42",
    });
    render(<IssueLinkText text="Fix #42" />);
    await waitFor(() => {
      expect(screen.getByTitle("Bug fix (open)")).toBeInTheDocument();
    });
  });

  it("shows 'open' badge with green color when issue is open", async () => {
    resolveIssueMock.mockResolvedValue({
      number: 42,
      title: "Bug fix",
      state: "open",
      url: "https://github.com/org/repo/issues/42",
    });
    render(<IssueLinkText text="Fix #42" />);
    await waitFor(() => {
      expect(screen.getByText("open")).toBeInTheDocument();
    });
  });

  it("shows 'closed' badge when issue is closed", async () => {
    resolveIssueMock.mockResolvedValue({
      number: 100,
      title: "Old bug",
      state: "closed",
      url: "https://github.com/org/repo/issues/100",
    });
    render(<IssueLinkText text="Ref #100" />);
    await waitFor(() => {
      expect(screen.getByText("closed")).toBeInTheDocument();
    });
  });

  it("calls shell.openFile when clicking an issue with a URL", async () => {
    resolveIssueMock.mockResolvedValue({
      number: 42,
      title: "Bug fix",
      state: "open",
      url: "https://github.com/org/repo/issues/42",
    });
    render(<IssueLinkText text="Fix #42" />);
    await waitFor(() => {
      expect(screen.getByTitle("Bug fix (open)")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("#42"));
    expect(openFileMock).toHaveBeenCalledWith("https://github.com/org/repo/issues/42");
  });

  it("uses custom pattern when provided", async () => {
    resolveIssueMock.mockResolvedValue(null);
    // pattern prop is a raw regex string passed to new RegExp() — double backslash for \d
    const pattern = "JIRA-\\d+";
    const { container } = render(<IssueLinkText text="JIRA-123 fix" pattern={pattern} />);
    // The matched reference text appears in the output
    expect(container.textContent).toContain("JIRA-123");
    // resolve is called with the matched token
    await waitFor(
      () => {
        expect(resolveIssueMock).toHaveBeenCalledWith("JIRA-123");
      },
      { timeout: 3000 }
    );
  });

  it("renders text-only when issue resolution returns null", async () => {
    resolveIssueMock.mockResolvedValue(null);
    render(<IssueLinkText text="Fix #5" />);
    await waitFor(() => {
      expect(resolveIssueMock).toHaveBeenCalled();
    });
    // no badge should appear
    expect(screen.queryByText("open")).not.toBeInTheDocument();
    expect(screen.queryByText("closed")).not.toBeInTheDocument();
  });
});
