import { useEffect, useState } from "react";

import { getMe } from "../api/users";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { RoleBadge } from "../components/Badges";
import type { UserDto } from "../types/api";
import { formatDate } from "./pageUtils";

export function UserInfoPage() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMe() {
      try {
        setUser(await getMe());
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? `Failed to load profile: ${loadError.message}`
            : "Failed to load profile.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadMe();
  }, []);

  if (isLoading) {
    return <LoadingState message="Loading user profile..." />;
  }

  if (error || !user) {
    return <ErrorAlert>{error ?? "Unable to load user profile."}</ErrorAlert>;
  }

  return (
    <section>
      <h1 className="h2">User Information</h1>
      <p className="text-muted">Current user profile details</p>
      <div className="card shadow mt-4">
        <div className="card-header bg-primary text-white">
          <h2 className="h5 mb-0">Profile</h2>
        </div>
        <div className="card-body">
          <p>
            <span className="text-muted small d-block">Name</span>
            <strong>{user.fullName}</strong>
          </p>
          <p>
            <span className="text-muted small d-block">Email</span>
            {user.email}
          </p>
          <p>
            <span className="text-muted small d-block">Phone Number</span>
            {user.phoneNumber}
          </p>
          <p>
            <span className="text-muted small d-block">Timezone</span>
            {user.timezone}
          </p>
          <p>
            <span className="text-muted small d-block">Role</span>
            <RoleBadge role={user.role} />
          </p>
          <p>
            <span className="text-muted small d-block">Organization</span>
            {user.organizationName ?? user.organizationId}
          </p>
          <p>
            <span className="text-muted small d-block">Created At</span>
            {formatDate(user.createdAtUtc)}
          </p>
        </div>
      </div>
    </section>
  );
}
