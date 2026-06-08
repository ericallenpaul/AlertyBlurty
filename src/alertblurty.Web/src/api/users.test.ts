import { afterEach, describe, expect, it, vi } from "vitest";

import { http } from "./http";
import { createUser, updateUser } from "./users";
import { UserRole } from "../types/api";

describe("users api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends numeric roles in user create and update payloads", async () => {
    const post = vi.spyOn(http, "post").mockResolvedValue({
      data: {},
    });
    const put = vi.spyOn(http, "put").mockResolvedValue({
      data: {},
    });

    await createUser({
      organizationId: "organization-id",
      email: "admin@example.com",
      password: "password",
      fullName: "Admin User",
      phoneNumber: "555-0100",
      timezone: "America/New_York",
      role: UserRole.Admin,
      isActive: true,
    });

    await updateUser("user-id", {
      role: UserRole.SuperAdmin,
    });

    expect(post).toHaveBeenCalledWith(
      "/api/users",
      expect.objectContaining({ role: 1 }),
    );
    expect(put).toHaveBeenCalledWith(
      "/api/users/user-id",
      expect.objectContaining({ role: 2 }),
    );
  });
});
