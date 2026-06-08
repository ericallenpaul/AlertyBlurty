import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole, type UserDto } from "../types/api";
import { UsersPage } from "./UsersPage";

const auth = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const usersApi = vi.hoisted(() => ({
  getUsersByOrganization: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => auth);
vi.mock("../api/users", () => usersApi);

function user(id: string, role: UserRole, fullName: string): UserDto {
  return {
    id,
    createdAtUtc: "2026-06-08T12:00:00Z",
    organizationId: "org-id",
    email: `${id}@example.com`,
    fullName,
    phoneNumber: "+15551234567",
    timezone: "America/New_York",
    role,
    isActive: true,
  };
}

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.useAuth.mockReturnValue({
      claims: { role: UserRole.Admin, organizationId: "org-id" },
      isAuthenticated: true,
    });
    usersApi.getUsersByOrganization.mockResolvedValue([
      user("user", UserRole.User, "Regular User"),
      user("admin", UserRole.Admin, "Admin User"),
    ]);
  });

  it("filters users by role", async () => {
    render(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Regular User")).toBeVisible();
    expect(screen.getByText("Admin User")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: /^admins/i }));

    expect(screen.queryByText("Regular User")).not.toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeVisible();
  });
});
