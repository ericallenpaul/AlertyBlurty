import { jwtDecode } from "jwt-decode";

import { UserRole } from "../types/api";

const nameIdentifierClaims = [
  "sub",
  "nameid",
  "nameidentifier",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/nameidentifier",
];

const emailClaims = [
  "email",
  "emailaddress",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/email",
];

const roleClaims = [
  "role",
  "roles",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role",
];

const organizationClaims = [
  "OrganizationId",
  "organizationId",
  "organization_id",
  "org",
  "Org",
  "organization",
];

export type AuthClaims = {
  userId?: string;
  email?: string;
  role: UserRole;
  organizationId?: string;
  expiresAt: number;
};

type JwtPayload = Record<string, unknown> & {
  exp?: number;
};

function getFirstStringClaim(
  payload: Record<string, unknown>,
  claimNames: string[],
): string | undefined {
  for (const claimName of claimNames) {
    const value = payload[claimName];

    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function getFirstClaimValue(
  payload: Record<string, unknown>,
  claimNames: string[],
): unknown {
  for (const claimName of claimNames) {
    const value = payload[claimName];

    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

function normalizeRole(value: unknown): UserRole | null {
  const firstValue = Array.isArray(value) ? value[0] : value;

  if (typeof firstValue === "number") {
    return firstValue in UserRole ? firstValue : null;
  }

  if (typeof firstValue !== "string") {
    return null;
  }

  const trimmedRole = firstValue.trim();

  if (!trimmedRole) {
    return null;
  }

  const numericRole = Number(trimmedRole);
  if (Number.isInteger(numericRole) && numericRole in UserRole) {
    return numericRole;
  }

  switch (trimmedRole.toLowerCase()) {
    case "user":
      return UserRole.User;
    case "admin":
      return UserRole.Admin;
    case "superadmin":
    case "super admin":
      return UserRole.SuperAdmin;
    default:
      return null;
  }
}

export function decodeAuthToken(
  token: string | null | undefined,
): AuthClaims | null {
  if (!token) {
    return null;
  }

  try {
    const payload = jwtDecode<JwtPayload>(token);
    const expiresAt = payload.exp;

    if (!expiresAt || expiresAt <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    const role = normalizeRole(getFirstClaimValue(payload, roleClaims));

    if (role === null) {
      return null;
    }

    return {
      userId: getFirstStringClaim(payload, nameIdentifierClaims),
      email: getFirstStringClaim(payload, emailClaims),
      role,
      organizationId: getFirstStringClaim(payload, organizationClaims),
      expiresAt,
    };
  } catch {
    return null;
  }
}
