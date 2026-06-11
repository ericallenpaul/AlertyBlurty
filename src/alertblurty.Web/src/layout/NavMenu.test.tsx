import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { AuthProvider } from "../auth/AuthProvider";
import { NavMenu } from "./NavMenu";

function tokenWithPayload(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.`;
}

function validToken(): string {
  return tokenWithPayload({
    sub: "user-id",
    email: "user@example.com",
    role: "Admin",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
}

function renderNavMenu() {
  window.localStorage.setItem("authToken", validToken());

  return render(
    <MemoryRouter>
      <AuthProvider>
        <NavMenu />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("NavMenu", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("toggles the mobile collapse and closes it after selecting a link", async () => {
    renderNavMenu();
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: "Toggle navigation" });
    const nav = screen.getByRole("navigation").querySelector("#main-nav");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).not.toHaveClass("show");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(nav).toHaveClass("show");

    await user.click(screen.getByRole("link", { name: "Incidents" }));

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).not.toHaveClass("show");
  });

  it("includes an on-call calendar tab", () => {
    renderNavMenu();

    expect(
      screen.getByRole("link", { name: "On-Call Calendar" }),
    ).toHaveAttribute("href", "/on-call-calendar");
  });
});
