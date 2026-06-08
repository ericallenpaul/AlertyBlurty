import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "./AuthProvider";
import { ProtectedRoute } from "./ProtectedRoute";
import { UserRole } from "../types/api";

function tokenWithPayload(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function validToken(role: string): string {
  return tokenWithPayload({
    sub: "user-id",
    email: "user@example.com",
    role,
    exp: Math.floor(Date.now() / 1000) + 60,
  });
}

function renderProtected(initialPath = "/protected") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute requiredRoles={[UserRole.Admin]}>
                <div>Protected content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("redirects unauthenticated users to login", () => {
    renderProtected();

    expect(screen.getByText("Login page")).toBeVisible();
  });

  it("redirects authenticated users without required roles to dashboard", () => {
    window.localStorage.setItem("authToken", validToken("User"));

    renderProtected();

    expect(screen.getByText("Dashboard page")).toBeVisible();
  });

  it("renders protected content for users with required roles", () => {
    window.localStorage.setItem("authToken", validToken("Admin"));

    renderProtected();

    expect(screen.getByText("Protected content")).toBeVisible();
  });
});
