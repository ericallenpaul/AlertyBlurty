import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRole, type UserDto } from "../types/api";
import { UserDetailsPage } from "./UserDetailsPage";

const auth = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

const usersApi = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../auth/AuthProvider", () => auth);
vi.mock("../api/users", () => usersApi);

function user(role: UserRole): UserDto {
  return {
    id: "user-id",
    createdAtUtc: "2026-06-08T12:00:00Z",
    organizationId: "org-id",
    email: "user@example.com",
    fullName: "User Example",
    phoneNumber: "+15551234567",
    timezone: "America/New_York",
    role,
    isActive: true,
  };
}

function renderUserDetails() {
  return render(
    <MemoryRouter initialEntries={["/users/user-id"]}>
      <Routes>
        <Route path="/users/:id" element={<UserDetailsPage />} />
        <Route path="/users" element={<div>Users destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("UserDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.useAuth.mockReturnValue({
      claims: { role: UserRole.Admin, organizationId: "org-id" },
      isAuthenticated: true,
    });
    usersApi.getUser.mockResolvedValue(user(UserRole.User));
    usersApi.updateUser.mockImplementation((_id: string, request: object) =>
      Promise.resolve({ ...user(UserRole.User), ...request }),
    );
  });

  it("does not expose SuperAdmin role or delete action to admins", async () => {
    renderUserDetails();

    await screen.findByText("User Example");

    expect(screen.queryByText("Delete User")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Role")).not.toHaveTextContent("Super Admin");
  });

  it("does not let admins change an existing SuperAdmin role", async () => {
    usersApi.getUser.mockResolvedValue(user(UserRole.SuperAdmin));
    renderUserDetails();

    await screen.findByText("User Example");

    expect(screen.queryByLabelText("Role")).not.toBeInTheDocument();
    expect(
      screen.getByText("Role changes are restricted for Super Admin accounts."),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(usersApi.updateUser).toHaveBeenCalledWith(
        "user-id",
        expect.not.objectContaining({ role: expect.anything() }),
      ),
    );
  });

  it("allows SuperAdmins to choose SuperAdmin and delete users", async () => {
    auth.useAuth.mockReturnValue({
      claims: { role: UserRole.SuperAdmin, organizationId: "org-id" },
      isAuthenticated: true,
    });
    renderUserDetails();

    await screen.findByText("User Example");

    expect(screen.getByLabelText("Role")).toHaveTextContent("Super Admin");
    await userEvent.click(screen.getByRole("button", { name: "Delete User" }));

    await waitFor(() =>
      expect(usersApi.deleteUser).toHaveBeenCalledWith("user-id"),
    );
    expect(screen.getByText("Users destination")).toBeVisible();
  });
});
