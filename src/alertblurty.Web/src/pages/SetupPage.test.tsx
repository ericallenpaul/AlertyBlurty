import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const setupApi = vi.hoisted(() => ({
  bootstrapSetup: vi.fn(),
  getSetupStatus: vi.fn(),
}));

vi.mock("../api/auth", () => authApi);
vi.mock("../api/setup", () => setupApi);

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
    setupApi.getSetupStatus.mockResolvedValue({
      isConfigured: false,
      databaseConfigured: true,
      databaseReachable: true,
      twilioConfigured: true,
      jwtConfigured: true,
      hasOrganizations: false,
    });
  });

  it("collects database and twilio settings before organization setup", async () => {
    setupApi.getSetupStatus.mockResolvedValue({
      isConfigured: false,
      databaseConfigured: false,
      databaseReachable: false,
      twilioConfigured: false,
      jwtConfigured: false,
      hasOrganizations: false,
    });
    setupApi.bootstrapSetup.mockResolvedValue(undefined);
    renderSetup();

    await screen.findByRole("heading", { name: "System Configuration" });
    fireEvent.change(screen.getByLabelText("Server *"), {
      target: { value: "postgres" },
    });
    fireEvent.change(screen.getByLabelText("Port *"), {
      target: { value: "5432" },
    });
    fireEvent.change(screen.getByLabelText("Database Name *"), {
      target: { value: "alertyblurty" },
    });
    fireEvent.change(screen.getByLabelText("Username *"), {
      target: { value: "alerty_app" },
    });
    fireEvent.change(screen.getByLabelText("Password *"), {
      target: { value: "db-secret" },
    });
    fireEvent.change(screen.getByLabelText("JWT Secret *"), {
      target: { value: "jwt-secret-with-enough-length-for-tests" },
    });
    fireEvent.change(screen.getByLabelText("Account SID *"), {
      target: { value: "AC123" },
    });
    fireEvent.change(screen.getByLabelText("Auth Token *"), {
      target: { value: "twilio-token" },
    });
    fireEvent.change(screen.getByLabelText("Phone Number *"), {
      target: { value: "+15555550100" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: /initialize database/i }),
    );

    await waitFor(() =>
      expect(setupApi.bootstrapSetup).toHaveBeenCalledWith({
        database: {
          server: "postgres",
          port: 5432,
          databaseName: "alertyblurty",
          username: "alerty_app",
          password: "db-secret",
        },
        twilio: {
          accountSid: "AC123",
          authToken: "twilio-token",
          phoneNumber: "+15555550100",
        },
        jwtSecret: "jwt-secret-with-enough-length-for-tests",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Organization Information" }),
    ).toBeVisible();
  });

  it("validates required admin account fields before registering", async () => {
    renderSetup();

    await screen.findByRole("heading", { name: "Organization Information" });
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

    await screen.findByRole("heading", { name: "Organization Information" });
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
    expect(screen.getByText("Setup Complete")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: /go to dashboard/i }),
    );
    expect(screen.getByText("Dashboard destination")).toBeVisible();
  });
});
