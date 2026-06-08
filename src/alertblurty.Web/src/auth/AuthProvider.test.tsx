import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./AuthProvider";
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

function validToken(payload: Record<string, unknown> = {}): string {
  return tokenWithPayload({
    sub: "user-id",
    email: "user@example.com",
    role: "User",
    exp: Math.floor(Date.now() / 1000) + 60,
    ...payload,
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

function renderWithProvider(children: ReactNode) {
  return render(<AuthProvider>{children}</AuthProvider>);
}

function AuthStateProbe() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="email">{auth.claims?.email ?? "none"}</div>
      <button
        type="button"
        onClick={() =>
          void auth.login({
            email: "user@example.com",
            password: "password",
          })
        }
      >
        Log in
      </button>
      <button type="button" onClick={auth.logout}>
        Log out
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes authenticated state from a valid stored token", () => {
    window.localStorage.setItem("authToken", validToken());

    renderWithProvider(<AuthStateProbe />);

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("email")).toHaveTextContent("user@example.com");
  });

  it("clears invalid and expired stored tokens on startup", () => {
    window.localStorage.setItem(
      "authToken",
      tokenWithPayload({
        sub: "user-id",
        email: "user@example.com",
        role: "User",
        exp: Math.floor(Date.now() / 1000) - 60,
      }),
    );

    renderWithProvider(<AuthStateProbe />);

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(window.localStorage.getItem("authToken")).toBeNull();
  });

  it("stores a login token and updates authenticated state", async () => {
    const token = validToken({ email: "login@example.com" });
    authApi.login.mockResolvedValue(authResponse(token));

    renderWithProvider(<AuthStateProbe />);
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() =>
      expect(screen.getByTestId("authenticated")).toHaveTextContent("true"),
    );
    expect(screen.getByTestId("email")).toHaveTextContent("login@example.com");
    expect(window.localStorage.getItem("authToken")).toBe(token);
  });

  it("clears auth state and token on logout", async () => {
    window.localStorage.setItem("authToken", validToken());

    renderWithProvider(<AuthStateProbe />);
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(window.localStorage.getItem("authToken")).toBeNull();
  });

  it("clears mounted auth state when the stored token expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00Z"));
    const expiresAt = Math.floor(Date.now() / 1000) + 5;
    window.localStorage.setItem("authToken", validToken({ exp: expiresAt }));

    renderWithProvider(<AuthStateProbe />);

    expect(screen.getByTestId("authenticated")).toHaveTextContent("true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.getByTestId("authenticated")).toHaveTextContent("false");
    expect(window.localStorage.getItem("authToken")).toBeNull();
  });
});
