import { NavLink } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { UserRole } from "../types/api";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link active" : "nav-link";
}

export function NavMenu() {
  const { claims, isAuthenticated } = useAuth();
  const canManage =
    claims?.role === UserRole.Admin || claims?.role === UserRole.SuperAdmin;

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <NavLink className="navbar-brand" to="/dashboard">
          AlertyBlurty
        </NavLink>
        <button
          aria-controls="main-nav"
          aria-expanded="false"
          aria-label="Toggle navigation"
          className="navbar-toggler"
          data-bs-target="#main-nav"
          data-bs-toggle="collapse"
          type="button"
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="main-nav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <NavLink className={navLinkClass} to="/dashboard">
                Dashboard
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={navLinkClass} to="/incidents">
                Incidents
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={navLinkClass} to="/teams">
                Teams
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={navLinkClass} to="/user-info">
                User Info
              </NavLink>
            </li>
            {canManage ? (
              <>
                <li className="nav-item">
                  <NavLink className={navLinkClass} to="/users">
                    Users
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={navLinkClass} to="/setup">
                    Setup
                  </NavLink>
                </li>
              </>
            ) : null}
          </ul>
          <ul className="navbar-nav">
            <li className="nav-item">
              <NavLink className={navLinkClass} to="/logout">
                Logout
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
