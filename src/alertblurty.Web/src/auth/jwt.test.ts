import { describe, expect, it } from "vitest";

import { decodeAuthToken } from "./jwt";
import { UserRole } from "../types/api";

function tokenWithPayload(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

describe("decodeAuthToken", () => {
  it("maps JWT string roles to numeric user roles", () => {
    const token = tokenWithPayload({
      sub: "user-id",
      email: "admin@example.com",
      role: "Admin",
      OrganizationId: "organization-id",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    expect(decodeAuthToken(token)).toEqual({
      userId: "user-id",
      email: "admin@example.com",
      role: UserRole.Admin,
      organizationId: "organization-id",
      expiresAt: expect.any(Number),
    });
  });

  it("maps role claim URI aliases and numeric role values", () => {
    const token = tokenWithPayload({
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier":
        "user-id",
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress":
        "user@example.com",
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": 1,
      org: "organization-id",
      exp: Math.floor(Date.now() / 1000) + 60,
    });

    expect(decodeAuthToken(token)).toMatchObject({
      userId: "user-id",
      email: "user@example.com",
      role: UserRole.Admin,
      organizationId: "organization-id",
    });
  });

  it("returns null for expired or invalid tokens", () => {
    const expiredToken = tokenWithPayload({
      sub: "user-id",
      email: "user@example.com",
      role: "User",
      exp: Math.floor(Date.now() / 1000) - 60,
    });

    expect(decodeAuthToken(expiredToken)).toBeNull();
    expect(decodeAuthToken("not-a-token")).toBeNull();
  });
});
