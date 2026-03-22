// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const mockDismissToast = vi.fn();
let mockToasts: { id: number; text: string; type: "error" | "info" }[] = [];

vi.mock("../../store/ui-store", () => ({
  useUIStore: (selector?: (s: unknown) => unknown) => {
    const state = { toasts: mockToasts, dismissToast: mockDismissToast };
    return selector ? selector(state) : state;
  },
}));

// Import after mock is set up
import { ToastContainer } from "./ToastContainer";

beforeEach(() => {
  vi.clearAllMocks();
  mockToasts = [];
});

describe("ToastContainer", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a single info toast with its message", () => {
    mockToasts = [{ id: 1, text: "Operation successful", type: "info" }];
    render(<ToastContainer />);
    expect(screen.getByText("Operation successful")).toBeInTheDocument();
  });

  it("renders a single error toast", () => {
    mockToasts = [{ id: 2, text: "Something went wrong", type: "error" }];
    render(<ToastContainer />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders multiple toasts", () => {
    mockToasts = [
      { id: 1, text: "First message", type: "info" },
      { id: 2, text: "Second message", type: "error" },
    ];
    render(<ToastContainer />);
    expect(screen.getByText("First message")).toBeInTheDocument();
    expect(screen.getByText("Second message")).toBeInTheDocument();
  });

  it("calls dismissToast with the toast id when clicked", () => {
    mockToasts = [{ id: 42, text: "Click to dismiss", type: "info" }];
    render(<ToastContainer />);
    fireEvent.click(screen.getByText("Click to dismiss").closest("div")!);
    expect(mockDismissToast).toHaveBeenCalledWith(42);
  });
});
