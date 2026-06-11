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

  it("collapses and expands the sidebar", async () => {
    renderNavMenu();
    const user = userEvent.setup();
    const toggle = screen.getByRole("button", { name: "Collapse navigation" });
    const nav = screen.getByRole("navigation");

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(nav).toHaveClass("app-sidebar-expanded");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(nav).toHaveClass("app-sidebar-collapsed");

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));

    expect(nav).toHaveClass("app-sidebar-expanded");
  });

  it("persists the collapsed sidebar preference without a separate pin control", async () => {
    renderNavMenu();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole("button", { name: "Collapse navigation" }),
    );

    expect(window.localStorage.getItem("sidebarExpanded")).toBe("false");
    expect(
      screen.queryByRole("button", { name: /pin navigation/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /unpin navigation/i }),
    ).toBeNull();
  });

  it("opens and closes the mobile sidebar", async () => {
    renderNavMenu();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Open navigation" }));

    expect(screen.getByRole("navigation")).toHaveClass(
      "app-sidebar-mobile-open",
    );

    await user.click(screen.getByRole("link", { name: "Incidents" }));

    expect(screen.getByRole("navigation")).not.toHaveClass(
      "app-sidebar-mobile-open",
    );
  });

  it("includes an on-call calendar tab", () => {
    renderNavMenu();

    expect(
      screen.getByRole("link", { name: "On-Call Calendar" }),
    ).toHaveAttribute("href", "/on-call-calendar");
  });

  it("uses icon treatments for navigation links and controls", () => {
    const { container } = renderNavMenu();

    expect(
      screen
        .getByRole("link", { name: "Dashboard" })
        .querySelector(".bi-speedometer2"),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Incidents" })
        .querySelector(".bi-exclamation-triangle"),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("link", { name: "On-Call Calendar" })
        .querySelector(".bi-calendar-week"),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Collapse navigation" })
        .querySelector(".bi-layout-sidebar-inset"),
    ).not.toBeNull();
    expect(container.querySelector(".app-sidebar-initial")).toBeNull();
  });
});
