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

  it("lets admins update roles and delete users", async () => {
    renderUserDetails();

    await screen.findByText("User Example");

    expect(screen.getByRole("button", { name: "Delete User" })).toBeVisible();
    expect(screen.getByLabelText("Role")).toHaveTextContent("Admin");
    await userEvent.selectOptions(screen.getByLabelText("Role"), [
      String(UserRole.Admin),
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(usersApi.updateUser).toHaveBeenCalledWith(
        "user-id",
        expect.objectContaining({ role: UserRole.Admin }),
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete User" }));

    await waitFor(() =>
      expect(usersApi.deleteUser).toHaveBeenCalledWith("user-id"),
    );
    expect(screen.getByText("Users destination")).toBeVisible();
  });
});
