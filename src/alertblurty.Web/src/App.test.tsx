import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";

const organizationsApi = vi.hoisted(() => ({
  hasOrganizations: vi.fn(),
}));

vi.mock("./api/organizations", () => organizationsApi);

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("routes unauthenticated users from home to login when setup is complete", async () => {
    organizationsApi.hasOrganizations.mockResolvedValue(true);

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
