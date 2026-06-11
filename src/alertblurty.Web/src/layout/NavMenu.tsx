import { useState } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { UserRole } from "../types/api";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "app-sidebar-link active" : "app-sidebar-link";
}

const sidebarExpandedStorageKey = "sidebarExpanded";

type NavItem = {
  label: string;
  to: string;
  icon: string;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: "bi-speedometer2" },
  { label: "Incidents", to: "/incidents", icon: "bi-exclamation-triangle" },
  { label: "Teams", to: "/teams", icon: "bi-people" },
  {
    label: "On-Call Calendar",
    to: "/on-call-calendar",
    icon: "bi-calendar-week",
  },
  { label: "User Info", to: "/user-info", icon: "bi-person-circle" },
  { label: "Users", to: "/users", icon: "bi-person-gear", adminOnly: true },
];

export function NavMenu() {
  const { claims, isAuthenticated } = useAuth();
  const [isExpanded, setIsExpanded] = useState(() => {
    return window.localStorage.getItem(sidebarExpandedStorageKey) !== "false";
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
    setIsExpanded((current) => {
      const next = !current;
      window.localStorage.setItem(sidebarExpandedStorageKey, String(next));
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
          <i aria-hidden="true" className="bi bi-list" />
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
            <i
              aria-hidden="true"
              className={`bi ${
                isExpanded ? "bi-layout-sidebar-inset" : "bi-layout-sidebar"
              }`}
            />
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
                <span className="app-sidebar-icon" aria-hidden="true">
                  <i className={`bi ${item.icon}`} />
                </span>
                <span className="app-sidebar-label">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <NavLink className={navLinkClass} onClick={closeMobileNav} to="/logout">
          <span className="app-sidebar-icon" aria-hidden="true">
            <i className="bi bi-box-arrow-right" />
          </span>
          <span className="app-sidebar-label">Logout</span>
        </NavLink>
      </nav>
    </>
  );
}
