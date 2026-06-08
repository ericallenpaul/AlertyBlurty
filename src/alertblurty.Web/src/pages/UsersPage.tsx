import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getUsersByOrganization } from "../api/users";
import { useAuth } from "../auth/AuthProvider";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { RoleBadge } from "../components/Badges";
import { UserRole, type UserDto } from "../types/api";
import { errorMessage } from "./pageUtils";

type RoleFilter = UserRole | "all";

export function UsersPage() {
  const { claims } = useAuth();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUsers() {
      if (!claims?.organizationId) {
        setError("Unable to determine your organization.");
        setIsLoading(false);
        return;
      }

      try {
        setUsers(await getUsersByOrganization(claims.organizationId));
      } catch (loadError) {
        setError(errorMessage(loadError, "Failed to load users"));
      } finally {
        setIsLoading(false);
      }
    }

    void loadUsers();
  }, [claims?.organizationId]);

  const counts = useMemo(
    () => ({
      superAdmins: users.filter((user) => user.role === UserRole.SuperAdmin)
        .length,
      admins: users.filter((user) => user.role === UserRole.Admin).length,
      users: users.filter((user) => user.role === UserRole.User).length,
    }),
    [users],
  );
  const filtered =
    filter === "all" ? users : users.filter((user) => user.role === filter);

  if (isLoading) {
    return <LoadingState message="Loading users..." />;
  }

  return (
    <section>
      <div className="row mb-4">
        <div className="col">
          <h1 className="h2">Users</h1>
          <p className="text-muted">Manage user accounts and permissions</p>
        </div>
        <div className="col-auto">
          <Link className="btn btn-primary" to="/users/create">
            Add User
          </Link>
        </div>
      </div>
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      <div className="card shadow mb-4">
        <div className="card-body">
          <ul className="nav nav-tabs">
            <RoleFilterButton
              active={filter === "all"}
              label={`All Users (${users.length})`}
              onClick={() => setFilter("all")}
            />
            <RoleFilterButton
              active={filter === UserRole.SuperAdmin}
              label={`Super Admins (${counts.superAdmins})`}
              onClick={() => setFilter(UserRole.SuperAdmin)}
            />
            <RoleFilterButton
              active={filter === UserRole.Admin}
              label={`Admins (${counts.admins})`}
              onClick={() => setFilter(UserRole.Admin)}
            />
            <RoleFilterButton
              active={filter === UserRole.User}
              label={`Users (${counts.users})`}
              onClick={() => setFilter(UserRole.User)}
            />
          </ul>
        </div>
      </div>
      <div className="card shadow">
        <div className="card-header bg-primary text-white">
          <h2 className="h5 mb-0">
            {filter === "all" ? "All Users" : `${UserRole[filter]} Users`}
          </h2>
        </div>
        <div className="card-body">
          {filtered.length === 0 ? (
            <p className="text-muted mb-0">No users found</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone Number</th>
                    <th>Role</th>
                    <th>Timezone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.fullName}</strong>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.phoneNumber}</td>
                      <td>
                        <RoleBadge role={user.role} />
                      </td>
                      <td>{user.timezone}</td>
                      <td>
                        <span
                          className={`badge ${user.isActive ? "bg-success" : "bg-secondary"}`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="btn btn-sm btn-outline-primary"
                          to={`/users/${user.id}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RoleFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <li className="nav-item">
      <button
        className={`nav-link${active ? " active" : ""}`}
        onClick={onClick}
        type="button"
      >
        {label}
      </button>
    </li>
  );
}
