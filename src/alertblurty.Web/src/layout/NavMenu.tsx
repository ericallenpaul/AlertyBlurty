import { useState } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { UserRole } from "../types/api";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "app-sidebar-link active" : "app-sidebar-link";
}

const pinStorageKey = "sidebarPinned";

type NavItem = {
  label: string;
  to: string;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Incidents", to: "/incidents" },
  { label: "Teams", to: "/teams" },
  { label: "On-Call Calendar", to: "/on-call-calendar" },
  { label: "User Info", to: "/user-info" },
  { label: "Users", to: "/users", adminOnly: true },
];

export function NavMenu() {
  const { claims, isAuthenticated } = useAuth();
  const [isExpanded, setIsExpanded] = useState(() => {
    return window.localStorage.getItem(pinStorageKey) !== "false";
  });
  const [isPinned, setIsPinned] = useState(() => {
    return window.localStorage.getItem(pinStorageKey) !== "false";
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const canManage = claims?.role === UserRole.Admin;

  if (!isAuthenticated) {
    return null;
  }

  function closeMobileNav() {
    setIsMobileOpen(false);
  }

  function toggleExpanded() {
    setIsExpanded((current) => !current);
  }

  function togglePinned() {
    setIsPinned((current) => {
      const next = !current;
      window.localStorage.setItem(pinStorageKey, String(next));
      if (next) {
        setIsExpanded(true);
      }
      return next;
    });
  }

  const visibleItems = navItems.filter((item) => !item.adminOnly || canManage);

  return (
    <>
      <div className="app-mobile-bar">
        <button
          aria-label="Open navigation"
          className="btn btn-primary app-icon-button"
          onClick={() => setIsMobileOpen(true)}
          type="button"
        >
          <span aria-hidden="true">Menu</span>
        </button>
        <img
          alt="AlertyBlurty"
          className="app-mobile-logo"
          src="/alerty-blurty-logo.png"
        />
      </div>
      {isMobileOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="app-sidebar-backdrop"
          onClick={closeMobileNav}
          type="button"
        />
      ) : null}
      <nav
        aria-label="Primary"
        className={[
          "app-sidebar",
          isExpanded ? "app-sidebar-expanded" : "app-sidebar-collapsed",
          isMobileOpen ? "app-sidebar-mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <NavLink
          className="app-sidebar-brand"
          onClick={closeMobileNav}
          to="/dashboard"
        >
          <img
            alt="AlertyBlurty"
            className="app-sidebar-logo"
            src="/alerty-blurty-logo.png"
          />
        </NavLink>
        <div className="app-sidebar-controls">
          <button
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? "Collapse navigation" : "Expand navigation"
            }
            className="btn btn-outline-light app-icon-button"
            onClick={toggleExpanded}
            type="button"
          >
            <span aria-hidden="true">{isExpanded ? "<" : ">"}</span>
          </button>
          <button
            aria-label={isPinned ? "Unpin navigation" : "Pin navigation"}
            className="btn btn-outline-light app-icon-button"
            onClick={togglePinned}
            type="button"
          >
            <span aria-hidden="true">{isPinned ? "Pinned" : "Pin"}</span>
          </button>
        </div>
        <ul className="app-sidebar-list">
          {visibleItems.map((item) => (
            <li className="app-sidebar-item" key={item.to}>
              <NavLink
                className={navLinkClass}
                onClick={closeMobileNav}
                to={item.to}
              >
                <span className="app-sidebar-initial" aria-hidden="true">
                  {item.label.slice(0, 1)}
                </span>
                <span className="app-sidebar-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <NavLink className={navLinkClass} onClick={closeMobileNav} to="/logout">
          <span className="app-sidebar-initial" aria-hidden="true">
            L
          </span>
          <span className="app-sidebar-label">Logout</span>
        </NavLink>
      </nav>
    </>
  );
}
