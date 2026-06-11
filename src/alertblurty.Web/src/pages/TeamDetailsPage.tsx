import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getUsersByOrganization } from "../api/users";
import {
  addTeamMember,
  getTeam,
  getTeamMembers,
  removeTeamMember,
} from "../api/teams";
import { useAuth } from "../auth/AuthProvider";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { TeamSchedulePanel } from "../components/team-schedule/TeamSchedulePanel";
import {
  UserRole,
  type TeamDto,
  type TeamMemberDto,
  type UserDto,
} from "../types/api";
import { errorMessage } from "./pageUtils";

function canManage(role?: UserRole) {
  return role === UserRole.Admin || role === UserRole.SuperAdmin;
}

export function TeamDetailsPage() {
  const { id } = useParams();
  const { claims } = useAuth();
  const [team, setTeam] = useState<TeamDto | null>(null);
  const [members, setMembers] = useState<TeamMemberDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [rotationOrder, setRotationOrder] = useState(1);
  const mayManage = canManage(claims?.role);

  async function loadTeamDetails() {
    if (!id) {
      setError("Team id is missing.");
      setIsLoading(false);
      return;
    }

    try {
      setTeam(await getTeam(id));
      setMembers(await getTeamMembers(id));
    } catch (loadError) {
      setError(errorMessage(loadError, "Failed to load team details"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadTeamDetails);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const availableUsers = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.userId));
    return users.filter((user) => user.isActive && !memberIds.has(user.id));
  }, [members, users]);

  async function openAddMember() {
    setShowAdd(true);
    setRotationOrder(members.length + 1);
    setSelectedUserId("");

    if (!claims?.organizationId) {
      setError("Unable to determine your organization.");
      return;
    }

    try {
      setUsers(await getUsersByOrganization(claims.organizationId));
    } catch (loadError) {
      setError(errorMessage(loadError, "Failed to load users"));
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !selectedUserId) {
      setError("Please select a user.");
      return;
    }

    try {
      await addTeamMember(id, { userId: selectedUserId, rotationOrder });
      setSuccess("Member added successfully!");
      setShowAdd(false);
      await loadTeamDetails();
    } catch (addError) {
      setError(errorMessage(addError, "Error adding member"));
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!id) {
      return;
    }

    try {
      await removeTeamMember(id, userId);
      setSuccess("Member removed successfully!");
      await loadTeamDetails();
    } catch (removeError) {
      setError(errorMessage(removeError, "Error removing member"));
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading team details..." />;
  }

  if (error && !team) {
    return (
      <>
        <ErrorAlert>{error}</ErrorAlert>
        <Link className="btn btn-secondary" to="/teams">
          Back to Teams
        </Link>
      </>
    );
  }

  if (!team) {
    return <ErrorAlert>Team not found.</ErrorAlert>;
  }

  return (
    <section>
      <Link className="btn btn-secondary mb-3" to="/teams">
        Back to Teams
      </Link>
      <h1 className="h2">{team.name}</h1>
      <p className="text-muted">{team.description}</p>
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
              <h2 className="h5 mb-0">Team Information</h2>
            </div>
            <div className="card-body">
              <p>
                <span className="text-muted small d-block">Team Name</span>
                <strong>{team.name}</strong>
              </p>
              <p>
                <span className="text-muted small d-block">
                  Requires Admin Approval for Swaps
                </span>
                {team.requireAdminApprovalForSwaps ? "Yes" : "No"}
              </p>
            </div>
          </div>
          <div className="card shadow">
            <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
              <h2 className="h5 mb-0">Team Members ({members.length})</h2>
              {mayManage ? (
                <button
                  className="btn btn-light btn-sm"
                  onClick={() => void openAddMember()}
                  type="button"
                >
                  Add Member
                </button>
              ) : null}
            </div>
            <div className="card-body">
              {members.length === 0 ? (
                <p className="text-muted mb-0">
                  No members yet. Add team members to get started.
                </p>
              ) : (
                <div className="list-group list-group-flush">
                  {members.map((member) => (
                    <div
                      className="list-group-item d-flex justify-content-between align-items-center"
                      key={member.id}
                    >
                      <div>
                        <strong>{member.userFullName ?? member.userId}</strong>
                        <br />
                        <small className="text-muted">{member.userEmail}</small>
                      </div>
                      <div>
                        <span className="badge badge-alerty me-2">
                          Order: {member.rotationOrder}
                        </span>
                        <span
                          className={`badge ${member.isActive ? "bg-success" : "bg-secondary"} me-2`}
                        >
                          {member.isActive ? "Active" : "Inactive"}
                        </span>
                        {mayManage ? (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              void handleRemoveMember(member.userId)
                            }
                            type="button"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <TeamSchedulePanel
            canManage={mayManage}
            currentUserId={claims?.userId}
            members={members}
            teamId={team.id}
          />
        </div>
        <div className="col-lg-4">
          <div className="card shadow">
            <div className="card-header bg-primary text-white">
              <h2 className="h5 mb-0">Statistics</h2>
            </div>
            <div className="card-body">
              <p>
                Total Members: <strong>{members.length}</strong>
              </p>
              <p>
                Active Members:{" "}
                <strong>
                  {members.filter((member) => member.isActive).length}
                </strong>
              </p>
            </div>
          </div>
        </div>
      </div>
      {showAdd ? (
        <div
          aria-labelledby="add-team-member-dialog-title"
          aria-modal="true"
          className="modal show d-block"
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={handleAddMember}>
              <div className="modal-header bg-primary text-white">
                <h2
                  className="h5 modal-title"
                  id="add-team-member-dialog-title"
                >
                  Add Team Member
                </h2>
                <button
                  aria-label="Close add member dialog"
                  className="btn-close btn-close-white"
                  onClick={() => setShowAdd(false)}
                  type="button"
                />
              </div>
              <div className="modal-body">
                {availableUsers.length === 0 ? (
                  <div className="alert alert-warning">
                    No users available to add. Please create users first.
                  </div>
                ) : (
                  <>
                    <label className="form-label" htmlFor="selectedUser">
                      Select User *
                    </label>
                    <select
                      className="form-select mb-3"
                      id="selectedUser"
                      onChange={(event) =>
                        setSelectedUserId(event.target.value)
                      }
                      value={selectedUserId}
                    >
                      <option value="">-- Select a user --</option>
                      {availableUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.fullName} ({user.email})
                        </option>
                      ))}
                    </select>
                    <label className="form-label" htmlFor="rotationOrder">
                      Rotation Order *
                    </label>
                    <input
                      className="form-control"
                      id="rotationOrder"
                      min={1}
                      onChange={(event) =>
                        setRotationOrder(Number(event.target.value))
                      }
                      type="number"
                      value={rotationOrder}
                    />
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowAdd(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit">
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
