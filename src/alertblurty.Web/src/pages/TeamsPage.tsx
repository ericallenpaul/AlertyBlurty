import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { createTeam, getTeamsByOrganization } from "../api/teams";
import { useAuth } from "../auth/AuthProvider";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { UserRole, type TeamDto } from "../types/api";
import { errorMessage } from "./pageUtils";

function canManage(role?: UserRole) {
  return role === UserRole.Admin || role === UserRole.SuperAdmin;
}

export function TeamsPage() {
  const { claims } = useAuth();
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const mayManage = canManage(claims?.role);

  async function loadTeams() {
    if (!claims?.organizationId) {
      setError("Unable to determine your organization.");
      setIsLoading(false);
      return;
    }

    try {
      setTeams(await getTeamsByOrganization(claims.organizationId));
    } catch (loadError) {
      setError(errorMessage(loadError, "Failed to load teams"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadTeams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims?.organizationId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Please enter a team name.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await createTeam({
        name: name.trim(),
        description: description.trim(),
        requireAdminApprovalForSwaps: requireApproval,
      });
      setSuccess(`Team '${name.trim()}' created successfully!`);
      setShowCreate(false);
      setName("");
      setDescription("");
      setRequireApproval(false);
      await loadTeams();
    } catch (createError) {
      setError(errorMessage(createError, "Error creating team"));
    } finally {
      setIsCreating(false);
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading teams..." />;
  }

  return (
    <section>
      <div className="row mb-4">
        <div className="col">
          <h1 className="h2">Teams</h1>
          <p className="text-muted">
            Manage on-call teams and escalation groups
          </p>
        </div>
        {mayManage ? (
          <div className="col-auto">
            <button
              className="btn btn-primary"
              onClick={() => setShowCreate(true)}
              type="button"
            >
              New Team
            </button>
          </div>
        ) : null}
      </div>
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {success ? (
        <div className="alert alert-success" role="status">
          {success}
        </div>
      ) : null}
      {teams.length === 0 ? (
        <div className="card shadow">
          <div className="card-body text-center py-5 text-muted">
            No teams found
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {teams.map((team) => (
            <div className="col-md-6 col-xl-4" key={team.id}>
              <div className="card shadow h-100">
                <div className="card-body">
                  <h2 className="h5">{team.name}</h2>
                  <p className="text-muted">
                    {team.description || "No description"}
                  </p>
                  <p className="mb-3">
                    <span
                      className={`badge ${team.requireAdminApprovalForSwaps ? "bg-warning text-dark" : "bg-success"}`}
                    >
                      Swaps{" "}
                      {team.requireAdminApprovalForSwaps
                        ? "require approval"
                        : "do not require approval"}
                    </span>
                  </p>
                  <Link
                    className="btn btn-sm btn-outline-primary"
                    to={`/teams/${team.id}`}
                  >
                    View Team
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showCreate ? (
        <div
          aria-labelledby="create-team-dialog-title"
          aria-modal="true"
          className="modal show d-block"
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={handleCreate}>
              <div className="modal-header bg-primary text-white">
                <h2 className="h5 modal-title" id="create-team-dialog-title">
                  Create Team
                </h2>
                <button
                  aria-label="Close create team dialog"
                  className="btn-close btn-close-white"
                  onClick={() => setShowCreate(false)}
                  type="button"
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label" htmlFor="teamName">
                    Team Name *
                  </label>
                  <input
                    className="form-control"
                    id="teamName"
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label" htmlFor="teamDescription">
                    Description
                  </label>
                  <textarea
                    className="form-control"
                    id="teamDescription"
                    onChange={(event) => setDescription(event.target.value)}
                    value={description}
                  />
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    id="requireApproval"
                    onChange={(event) =>
                      setRequireApproval(event.target.checked)
                    }
                    type="checkbox"
                    checked={requireApproval}
                  />
                  <label className="form-check-label" htmlFor="requireApproval">
                    Require admin approval for swaps
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={isCreating}
                  type="submit"
                >
                  {isCreating ? "Creating..." : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
