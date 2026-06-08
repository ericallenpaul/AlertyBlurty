import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  UserRole,
  type TeamDto,
  type TeamMemberDto,
  type UserDto,
} from "../types/api";
import { TeamDetailsPage } from "./TeamDetailsPage";

const auth = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const teamsApi = vi.hoisted(() => ({
  addTeamMember: vi.fn(),
  getTeam: vi.fn(),
  getTeamMembers: vi.fn(),
  removeTeamMember: vi.fn(),
}));

const usersApi = vi.hoisted(() => ({
  getUsersByOrganization: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => auth);
vi.mock("../api/teams", () => teamsApi);
vi.mock("../api/users", () => usersApi);

const team: TeamDto = {
  id: "team-id",
  createdAtUtc: "2026-06-08T12:00:00Z",
  organizationId: "org-id",
  name: "Platform",
  description: "Production alerts",
  requireAdminApprovalForSwaps: false,
};

const member: TeamMemberDto = {
  id: "member-id",
  createdAtUtc: "2026-06-08T12:00:00Z",
  teamId: "team-id",
  userId: "member-user-id",
  rotationOrder: 1,
  isActive: true,
  userFullName: "Member User",
  userEmail: "member@example.com",
};

const availableUser: UserDto = {
  id: "available-user-id",
  createdAtUtc: "2026-06-08T12:00:00Z",
  organizationId: "org-id",
  email: "available@example.com",
  fullName: "Available User",
  phoneNumber: "+15551234567",
  timezone: "America/New_York",
  role: UserRole.User,
  isActive: true,
};

describe("TeamDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.useAuth.mockReturnValue({
      claims: { role: UserRole.Admin, organizationId: "org-id" },
      isAuthenticated: true,
    });
    teamsApi.getTeam.mockResolvedValue(team);
    teamsApi.getTeamMembers.mockResolvedValue([member]);
    usersApi.getUsersByOrganization.mockResolvedValue([availableUser]);
  });

  it("marks the add member modal as a dialog with an accessible close button", async () => {
    render(
      <MemoryRouter initialEntries={["/teams/team-id"]}>
        <Routes>
          <Route path="/teams/:id" element={<TeamDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Add Member" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Add Team Member" }),
    ).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByRole("button", { name: "Close add member dialog" }),
    ).toBeVisible();
  });
});
