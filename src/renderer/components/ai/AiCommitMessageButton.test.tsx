// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "ai.generateCommitMessage": "Generate commit message with AI",
        "ai.aiButtonLabel": "AI",
        "ai.aiGenerationFailed": "AI generation failed",
      };
      return translations[key] ?? key;
    },
    i18n: { language: "en" },
  }),
}));

const generateCommitMessageMock = vi.fn();

// Always return current state object — we control generating via closure
let mockGenerating = false;

vi.mock("../../store/mcp-store", () => ({
  useMcpStore: vi.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      get generating() {
        return mockGenerating;
      },
      generateCommitMessage: generateCommitMessageMock,
    };
    return selector ? selector(state as unknown as Record<string, unknown>) : state;
  }),
}));

import { AiCommitMessageButton } from "./AiCommitMessageButton";

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerating = false;
});

describe("AiCommitMessageButton", () => {
  it("renders the AI button", () => {
    generateCommitMessageMock.mockResolvedValue("feat: add feature");
    render(<AiCommitMessageButton onGenerated={vi.fn()} />);
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("button is enabled when not generating", () => {
    mockGenerating = false;
    render(<AiCommitMessageButton onGenerated={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();
  });

  it("button is disabled when generating", () => {
    mockGenerating = true;
    render(<AiCommitMessageButton onGenerated={vi.fn()} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows '...' text when generating", () => {
    mockGenerating = true;
    render(<AiCommitMessageButton onGenerated={vi.fn()} />);
    expect(screen.getByText("...")).toBeInTheDocument();
  });

  it("calls generateCommitMessage on button click", async () => {
    mockGenerating = false;
    generateCommitMessageMock.mockResolvedValue("feat: new feature");
    render(<AiCommitMessageButton onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(generateCommitMessageMock).toHaveBeenCalled();
    });
  });

  it("calls onGenerated with the result from generateCommitMessage", async () => {
    mockGenerating = false;
    const onGenerated = vi.fn();
    generateCommitMessageMock.mockResolvedValue("feat: auto message");
    render(<AiCommitMessageButton onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(onGenerated).toHaveBeenCalledWith("feat: auto message");
    });
  });

  it("shows error title on button when generation fails with Error", async () => {
    mockGenerating = false;
    generateCommitMessageMock.mockRejectedValue(new Error("API error"));
    render(<AiCommitMessageButton onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByTitle("API error")).toBeInTheDocument();
    });
  });

  it("shows default error message for non-Error failures", async () => {
    mockGenerating = false;
    generateCommitMessageMock.mockRejectedValue("unknown failure");
    render(<AiCommitMessageButton onGenerated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByTitle("AI generation failed")).toBeInTheDocument();
    });
  });

  it("has default title tooltip when no error", () => {
    mockGenerating = false;
    generateCommitMessageMock.mockResolvedValue("message");
    render(<AiCommitMessageButton onGenerated={vi.fn()} />);
    expect(screen.getByTitle("Generate commit message with AI")).toBeInTheDocument();
  });

  it("does not call onGenerated when generation fails", async () => {
    mockGenerating = false;
    const onGenerated = vi.fn();
    generateCommitMessageMock.mockRejectedValue(new Error("fail"));
    render(<AiCommitMessageButton onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByTitle("fail")).toBeInTheDocument();
    });
    expect(onGenerated).not.toHaveBeenCalled();
  });
});
