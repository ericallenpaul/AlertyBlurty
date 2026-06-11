import { useEffect, useState } from "react";

import { getTeamMembers, getTeamsByOrganization } from "../api/teams";
import { useAuth } from "../auth/AuthProvider";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { TeamSchedulePanel } from "../components/team-schedule/TeamSchedulePanel";
import { UserRole, type TeamDto, type TeamMemberDto } from "../types/api";
import { errorMessage } from "./pageUtils";

export function OnCallCalendarPage() {
  const { claims } = useAuth();
  const [teams, setTeams] = useState<TeamDto[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [members, setMembers] = useState<TeamMemberDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canManage = claims?.role === UserRole.Admin;

  useEffect(() => {
    async function loadTeams() {
      if (!claims?.organizationId) {
        setError("Unable to determine your organization.");
        setIsLoading(false);
        return;
      }

      try {
        setError(null);
        const loadedTeams = await getTeamsByOrganization(claims.organizationId);
        setTeams(loadedTeams);
        setSelectedTeamId((current) => current || loadedTeams[0]?.id || "");
      } catch (loadError) {
        setError(errorMessage(loadError, "Failed to load teams"));
      } finally {
        setIsLoading(false);
      }
    }

    void loadTeams();
  }, [claims?.organizationId]);

  useEffect(() => {
    async function loadMembers() {
      if (!selectedTeamId) {
        setMembers([]);
        return;
      }

      try {
        setError(null);
        setMembers(await getTeamMembers(selectedTeamId));
      } catch (loadError) {
        setError(errorMessage(loadError, "Failed to load team members"));
      }
    }

    void loadMembers();
  }, [selectedTeamId]);

  if (isLoading) {
    return <LoadingState message="Loading on-call calendar..." />;
  }

  if (error && teams.length === 0) {
    return <ErrorAlert>{error}</ErrorAlert>;
  }

  return (
    <section>
      <div className="d-flex flex-wrap gap-3 justify-content-between align-items-end mb-4">
        <div>
          <h1 className="h2">On-Call Calendar</h1>
          <p className="text-muted mb-0">Team schedules and swap coverage</p>
        </div>
        {teams.length > 0 ? (
          <div className="calendar-team-picker">
            <label className="form-label" htmlFor="calendarTeam">
              Team
            </label>
            <select
              className="form-select"
              id="calendarTeam"
              onChange={(event) => setSelectedTeamId(event.target.value)}
              value={selectedTeamId}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {error ? <ErrorAlert>{error}</ErrorAlert> : null}

      {selectedTeamId ? (
        <TeamSchedulePanel
          canManage={canManage}
          currentUserId={claims?.userId}
          members={members}
          teamId={selectedTeamId}
        />
      ) : (
        <div className="card shadow">
          <div className="card-body">
            <p className="text-muted mb-0">No teams available.</p>
          </div>
        </div>
      )}
    </section>
  );
}
