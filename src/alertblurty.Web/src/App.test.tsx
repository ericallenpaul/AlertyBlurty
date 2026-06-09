import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";

const setupApi = vi.hoisted(() => ({
  getSetupStatus: vi.fn(),
}));

vi.mock("./api/setup", () => setupApi);

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("routes unauthenticated users from home to login when setup is complete", async () => {
    setupApi.getSetupStatus.mockResolvedValue({
      isConfigured: true,
      databaseConfigured: true,
      databaseReachable: true,
      twilioConfigured: true,
      jwtConfigured: true,
      hasOrganizations: true,
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeVisible();
  });
});
