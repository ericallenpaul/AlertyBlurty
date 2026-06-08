import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { deleteUser, getUser, updateUser } from "../api/users";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { RoleBadge } from "../components/Badges";
import { UserRole, type UserDto } from "../types/api";
import { formatDate, timezones } from "./pageUtils";

export function UserDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [role, setRole] = useState(UserRole.User);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (!id) {
        setError("User id is missing.");
        setIsLoading(false);
        return;
      }

      try {
        const loaded = await getUser(id);
        setUser(loaded);
        setFullName(loaded.fullName);
        setPhoneNumber(loaded.phoneNumber);
        setTimezone(loaded.timezone);
        setRole(loaded.role);
        setIsActive(loaded.isActive);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? `Failed to load user: ${loadError.message}`
            : "Failed to load user.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadUser();
  }, [id]);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !fullName.trim() || !phoneNumber.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsUpdating(true);
    setError(null);
    try {
      const updated = await updateUser(id, {
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        timezone,
        role,
        isActive,
      });
      setUser(updated);
      setSuccess("User updated successfully!");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? `Error updating user: ${updateError.message}`
          : "Error updating user.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!id) {
      return;
    }

    try {
      await deleteUser(id);
      navigate("/users");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? `Error deleting user: ${deleteError.message}`
          : "Error deleting user.",
      );
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading user details..." />;
  }

  if (error && !user) {
    return (
      <>
        <ErrorAlert>{error}</ErrorAlert>
        <Link className="btn btn-secondary" to="/users">
          Back to Users
        </Link>
      </>
    );
  }

  if (!user) {
    return <ErrorAlert>User not found.</ErrorAlert>;
  }

  return (
    <section>
      <Link className="btn btn-secondary mb-3" to="/users">
        Back to Users
      </Link>
      <div className="row mb-4">
        <div className="col">
          <h1 className="h2">
            {user.fullName}{" "}
            <span
              className={`badge ${user.isActive ? "bg-success" : "bg-secondary"}`}
            >
              {user.isActive ? "Active" : "Inactive"}
            </span>
          </h1>
          <p className="text-muted">{user.email}</p>
        </div>
        <div className="col-auto">
          <button
            className="btn btn-outline-danger"
            onClick={() => void handleDelete()}
            type="button"
          >
            Delete User
          </button>
        </div>
      </div>
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {success ? (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      ) : null}
      <div className="row">
        <div className="col-lg-8">
          <div className="card shadow mb-4">
            <div className="card-header bg-primary text-white">
              <h2 className="h5 mb-0">Basic Information</h2>
            </div>
            <div className="card-body">
              <p>
                <span className="text-muted small d-block">Email Address</span>
                {user.email}
              </p>
              <p>
                <span className="text-muted small d-block">Role</span>
                <RoleBadge role={user.role} />
              </p>
              <p>
                <span className="text-muted small d-block">Organization</span>
                {user.organizationName ?? user.organizationId}
              </p>
            </div>
          </div>
          <form className="card shadow" onSubmit={handleUpdate}>
            <div className="card-header bg-primary text-white">
              <h2 className="h5 mb-0">Edit User</h2>
            </div>
            <div className="card-body">
              <div className="row">
                <Field
                  id="editFullName"
                  label="Full Name"
                  onChange={setFullName}
                  value={fullName}
                />
                <Field
                  id="editPhoneNumber"
                  label="Phone Number"
                  onChange={setPhoneNumber}
                  value={phoneNumber}
                />
                <div className="col-md-6 mb-3">
                  <label className="form-label" htmlFor="editTimezone">
                    Timezone
                  </label>
                  <select
                    className="form-select"
                    id="editTimezone"
                    onChange={(event) => setTimezone(event.target.value)}
                    value={timezone}
                  >
                    {timezones.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label" htmlFor="editRole">
                    Role
                  </label>
                  <select
                    className="form-select"
                    id="editRole"
                    onChange={(event) =>
                      setRole(Number(event.target.value) as UserRole)
                    }
                    value={role}
                  >
                    <option value={UserRole.User}>User</option>
                    <option value={UserRole.Admin}>Admin</option>
                    <option value={UserRole.SuperAdmin}>Super Admin</option>
                  </select>
                </div>
              </div>
              <div className="form-check mb-4">
                <input
                  checked={isActive}
                  className="form-check-input"
                  id="editIsActive"
                  onChange={(event) => setIsActive(event.target.checked)}
                  type="checkbox"
                />
                <label className="form-check-label" htmlFor="editIsActive">
                  Account is active
                </label>
              </div>
              <button
                className="btn btn-primary"
                disabled={isUpdating}
                type="submit"
              >
                {isUpdating ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
        <div className="col-lg-4">
          <div className="card shadow">
            <div className="card-header bg-primary text-white">
              <h2 className="h5 mb-0">Account Details</h2>
            </div>
            <div className="card-body">
              <p>
                <span className="text-muted small d-block">User ID</span>
                <code>{user.id}</code>
              </p>
              <p>
                <span className="text-muted small d-block">Created At</span>
                {formatDate(user.createdAtUtc)}
              </p>
              <p>
                <span className="text-muted small d-block">Last Updated</span>
                {formatDate(user.updatedAtUtc)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="col-md-6 mb-3">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="form-control"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}
