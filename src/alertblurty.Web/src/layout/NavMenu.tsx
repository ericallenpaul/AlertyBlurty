import { useState } from "react";
import { NavLink } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { UserRole } from "../types/api";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link active" : "nav-link";
}

export function NavMenu() {
  const { claims, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const canManage =
    claims?.role === UserRole.Admin || claims?.role === UserRole.SuperAdmin;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <NavLink
          className="navbar-brand"
          onClick={() => setIsOpen(false)}
          to="/dashboard"
        >
          AlertyBlurty
        </NavLink>
        <button
          aria-controls="main-nav"
          aria-expanded={isOpen}
          aria-label="Toggle navigation"
          className="navbar-toggler"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div
          className={`collapse navbar-collapse${isOpen ? " show" : ""}`}
          id="main-nav"
        >
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <NavLink
                className={navLinkClass}
                onClick={() => setIsOpen(false)}
                to="/dashboard"
              >
                Dashboard
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                className={navLinkClass}
                onClick={() => setIsOpen(false)}
                to="/incidents"
              >
                Incidents
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                className={navLinkClass}
                onClick={() => setIsOpen(false)}
                to="/teams"
              >
                Teams
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink
                className={navLinkClass}
                onClick={() => setIsOpen(false)}
                to="/user-info"
              >
                User Info
              </NavLink>
            </li>
            {canManage ? (
              <>
                <li className="nav-item">
                  <NavLink
                    className={navLinkClass}
                    onClick={() => setIsOpen(false)}
                    to="/users"
                  >
                    Users
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink
                    className={navLinkClass}
                    onClick={() => setIsOpen(false)}
                    to="/setup"
                  >
                    Setup
                  </NavLink>
                </li>
              </>
            ) : null}
          </ul>
          <ul className="navbar-nav">
            <li className="nav-item">
              <NavLink
                className={navLinkClass}
                onClick={() => setIsOpen(false)}
                to="/logout"
              >
                Logout
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
