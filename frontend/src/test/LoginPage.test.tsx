import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { LoginPage } from "../pages/LoginPage";
import * as api from "../lib/api";

// ── Mock react-router navigate ────────────────────────────────
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Mock auth API ─────────────────────────────────────────────
vi.mock("../lib/api", () => ({
  authApi: {
    login: vi.fn(),
  },
}));

// ── Mock Zustand store ────────────────────────────────────────
const mockSetAuth = vi.fn();
vi.mock("../store/authStore", () => ({
  useAuthStore: (selector: any) =>
    selector({ token: null, user: null, setAuth: mockSetAuth, logout: vi.fn() }),
}));

function renderLogin(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email, password fields and submit button", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows error banner on failed login", async () => {
    vi.mocked(api.authApi.login).mockRejectedValueOnce({
      response: { data: { error: "Invalid credentials" } },
    });

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i),    { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrongpass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials")
    );
  });

  it("calls setAuth and navigates to /dashboard on success", async () => {
    vi.mocked(api.authApi.login).mockResolvedValueOnce({
      data: { token: "jwt-token-123", user: { id: 1, name: "Alice", email: "a@b.com" } },
    } as any);

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i),    { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "correctPass" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSetAuth).toHaveBeenCalledWith("jwt-token-123", {
        id: 1, name: "Alice", email: "a@b.com",
      });
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true });
    });
  });

  it("disables button while submitting", async () => {
    vi.mocked(api.authApi.login).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i),    { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pass1234" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });
});
