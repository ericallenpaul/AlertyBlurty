import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { LoginPage } from "./LoginPage";
import { UserRole, type AuthResponse } from "../types/api";

const authApi = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock("../api/auth", () => authApi);

function tokenWithPayload(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function validToken(): string {
  return tokenWithPayload({
    sub: "user-id",
    email: "user@example.com",
    role: "User",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
}

function authResponse(token: string): AuthResponse {
  return {
    token,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: "user-id",
      createdAtUtc: new Date().toISOString(),
      organizationId: "organization-id",
      email: "user@example.com",
      fullName: "User Example",
      phoneNumber: "555-0100",
      timezone: "America/New_York",
      role: UserRole.User,
      isActive: true,
    },
  };
}

function renderProtectedLoginFlow() {
  return render(
    <MemoryRouter initialEntries={["/incidents"]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/incidents"
            element={
              <ProtectedRoute>
                <div>Incidents page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("returns users to the protected route they originally requested", async () => {
    authApi.login.mockResolvedValue(authResponse(validToken()));
    renderProtectedLoginFlow();

    await userEvent.type(
      screen.getByLabelText("Email address"),
      "user@example.com",
    );
    await userEvent.type(screen.getByLabelText("Password"), "password");
    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() =>
      expect(screen.getByText("Incidents page")).toBeVisible(),
    );
    expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
  });

  it("shows the expected placeholders and failure message", async () => {
    authApi.login.mockResolvedValue(null);
    renderProtectedLoginFlow();

    expect(
      screen.getByPlaceholderText("your.email@example.com"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Enter your password"),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Email address"),
      "user@example.com",
    );
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
  });
});
