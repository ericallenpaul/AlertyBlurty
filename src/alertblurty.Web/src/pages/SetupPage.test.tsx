import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { UserRole, type AuthResponse } from "../types/api";
import { SetupPage } from "./SetupPage";

const authApi = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}));

const organizationsApi = vi.hoisted(() => ({
  hasOrganizations: vi.fn(),
}));

vi.mock("../api/auth", () => authApi);
vi.mock("../api/organizations", () => organizationsApi);

function tokenWithPayload(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function authResponse(): AuthResponse {
  return {
    token: tokenWithPayload({
      sub: "admin-id",
      email: "admin@example.com",
      role: "SuperAdmin",
      OrganizationId: "org-id",
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    user: {
      id: "admin-id",
      createdAtUtc: new Date().toISOString(),
      organizationId: "org-id",
      email: "admin@example.com",
      fullName: "Admin User",
      phoneNumber: "+15551234567",
      timezone: "America/New_York",
      role: UserRole.SuperAdmin,
      isActive: true,
    },
  };
}

function renderSetup() {
  return render(
    <MemoryRouter initialEntries={["/setup"]}>
      <AuthProvider>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/dashboard" element={<div>Dashboard destination</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("SetupPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    organizationsApi.hasOrganizations.mockResolvedValue(false);
  });

  it("validates required admin account fields before registering", async () => {
    renderSetup();

    await screen.findByText("Step 1: Organization Information");
    await userEvent.type(
      screen.getByLabelText("Organization Name *"),
      "Acme Corporation",
    );
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await userEvent.click(
      screen.getByRole("button", { name: /complete setup/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please fill in all required fields correctly.",
    );
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("registers the first admin and shows the completion action", async () => {
    authApi.register.mockResolvedValue(authResponse());
    renderSetup();

    await screen.findByText("Step 1: Organization Information");
    await userEvent.type(
      screen.getByLabelText("Organization Name *"),
      "Acme Corporation",
    );
    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    await userEvent.type(screen.getByLabelText("Full Name *"), "Admin User");
    await userEvent.type(screen.getByLabelText("Email *"), "admin@example.com");
    await userEvent.type(screen.getByLabelText("Password *"), "password123");
    await userEvent.type(
      screen.getByLabelText("Confirm Password *"),
      "password123",
    );
    await userEvent.type(
      screen.getByLabelText("Phone Number *"),
      "+15551234567",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Timezone *"),
      "America/New_York",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /complete setup/i }),
    );

    await waitFor(() =>
      expect(authApi.register).toHaveBeenCalledWith({
        organizationName: "Acme Corporation",
        fullName: "Admin User",
        email: "admin@example.com",
        password: "password123",
        phoneNumber: "+15551234567",
        timezone: "America/New_York",
      }),
    );
    expect(screen.getByText("Setup Complete!")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: /go to dashboard/i }),
    );
    expect(screen.getByText("Dashboard destination")).toBeVisible();
  });
});
