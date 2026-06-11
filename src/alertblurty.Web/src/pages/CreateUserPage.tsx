import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createUser } from "../api/users";
import { useAuth } from "../auth/AuthProvider";
import { ErrorAlert } from "../components/ErrorAlert";
import { UserRole } from "../types/api";
import { timezones } from "./pageUtils";

export function CreateUserPage() {
  const { claims } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [role, setRole] = useState(UserRole.User);
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!claims?.organizationId) {
      setError("Unable to determine your organization.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createUser({
        organizationId: claims.organizationId,
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        timezone,
        role,
        isActive,
      });
      navigate("/users");
    } catch (createError) {
      setError(
        createError instanceof Error
          ? `Error creating user: ${createError.message}`
          : "Error creating user.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section>
      <Link className="btn btn-secondary mb-3" to="/users">
        Back to Users
      </Link>
      <h1 className="h2">Create New User</h1>
      <p className="text-muted">Add a new user to your organization</p>
      <div className="row">
        <div className="col-lg-8">
          <form className="card shadow" onSubmit={handleCreate}>
            <div className="card-header bg-primary text-white">
              <h2 className="h5 mb-0">User Information</h2>
            </div>
            <div className="card-body">
              {error ? <ErrorAlert>{error}</ErrorAlert> : null}
              <div className="row">
                <Field
                  id="fullName"
                  label="Full Name *"
                  onChange={setFullName}
                  value={fullName}
                />
                <Field
                  id="email"
                  label="Email Address *"
                  onChange={setEmail}
                  type="email"
                  value={email}
                />
                <Field
                  id="phoneNumber"
                  label="Phone Number *"
                  onChange={setPhoneNumber}
                  type="tel"
                  value={phoneNumber}
                />
                <div className="col-md-6 mb-3">
                  <label className="form-label" htmlFor="timezone">
                    Timezone *
                  </label>
                  <select
                    className="form-select"
                    id="timezone"
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
                  <label className="form-label" htmlFor="role">
                    Role *
                  </label>
                  <select
                    className="form-select"
                    id="role"
                    onChange={(event) =>
                      setRole(Number(event.target.value) as UserRole)
                    }
                    value={role}
                  >
                    <option value={UserRole.User}>User</option>
                    <option value={UserRole.Admin}>Admin</option>
                  </select>
                </div>
                <Field
                  id="password"
                  label="Password *"
                  onChange={setPassword}
                  type="password"
                  value={password}
                />
              </div>
              <div className="form-check mb-4">
                <input
                  checked={isActive}
                  className="form-check-input"
                  id="isActive"
                  onChange={(event) => setIsActive(event.target.checked)}
                  type="checkbox"
                />
                <label className="form-check-label" htmlFor="isActive">
                  Account is active
                </label>
              </div>
              <div className="d-flex justify-content-end gap-2">
                <Link className="btn btn-secondary" to="/users">
                  Cancel
                </Link>
                <button
                  className="btn btn-primary"
                  disabled={isCreating}
                  type="submit"
                >
                  {isCreating ? "Creating..." : "Create User"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  onChange,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  type?: string;
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
        type={type}
        value={value}
      />
    </div>
  );
}
