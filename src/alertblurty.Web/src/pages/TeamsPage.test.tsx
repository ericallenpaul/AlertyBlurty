import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole, type TeamDto } from "../types/api";
import { TeamsPage } from "./TeamsPage";

const auth = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const teamsApi = vi.hoisted(() => ({
  createTeam: vi.fn(),
  getTeamsByOrganization: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => auth);
vi.mock("../api/teams", () => teamsApi);

const team: TeamDto = {
  id: "team-id",
  createdAtUtc: "2026-06-08T12:00:00Z",
  organizationId: "org-id",
  name: "Platform",
  description: "Production alerts",
  requireAdminApprovalForSwaps: false,
};

describe("TeamsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.useAuth.mockReturnValue({
      claims: { role: UserRole.Admin, organizationId: "org-id" },
      isAuthenticated: true,
    });
    teamsApi.getTeamsByOrganization.mockResolvedValue([team]);
  });

  it("lets admins create teams and refreshes the list", async () => {
    teamsApi.createTeam.mockResolvedValue({
      ...team,
      id: "new-team-id",
      name: "Database",
    });

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: /new team/i }),
    );
    expect(screen.getByRole("dialog", { name: "Create Team" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Close create team dialog" }),
    ).toBeVisible();
    await userEvent.type(screen.getByLabelText("Team Name *"), "Database");
    await userEvent.type(screen.getByLabelText("Description"), "DB alerts");
    await userEvent.click(screen.getByRole("button", { name: "Create Team" }));

    await waitFor(() =>
      expect(teamsApi.createTeam).toHaveBeenCalledWith({
        name: "Database",
        description: "DB alerts",
        requireAdminApprovalForSwaps: false,
      }),
    );
    expect(teamsApi.getTeamsByOrganization).toHaveBeenCalledTimes(2);
  });

  it("hides create actions from regular users", async () => {
    auth.useAuth.mockReturnValue({
      claims: { role: UserRole.User, organizationId: "org-id" },
      isAuthenticated: true,
    });

    render(
      <MemoryRouter>
        <TeamsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Platform")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /new team/i }),
    ).not.toBeInTheDocument();
  });
});
