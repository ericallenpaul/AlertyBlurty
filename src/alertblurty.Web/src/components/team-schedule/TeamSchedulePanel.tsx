import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  approveSwapRequest,
  createSchedule,
  createSwapRequest,
  generateScheduleShifts,
  getScheduleShifts,
  getTeamSchedules,
  getTeamSwapRequests,
  rejectSwapRequest,
} from "../../api/schedules";
import {
  ScheduleFrequency,
  ShiftSwapRequestStatus,
  type OnCallScheduleDto,
  type OnCallShiftDto,
  type ShiftSwapRequestDto,
  type TeamMemberDto,
} from "../../types/api";
import { ErrorAlert } from "../ErrorAlert";

type TeamSchedulePanelProps = {
  teamId: string;
  members: TeamMemberDto[];
  currentUserId?: string;
  canManage: boolean;
};

function toInputDateTime(value: Date) {
  return value.toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TeamSchedulePanel({
  teamId,
  members,
  currentUserId,
  canManage,
}: TeamSchedulePanelProps) {
  const [schedules, setSchedules] = useState<OnCallScheduleDto[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [shifts, setShifts] = useState<OnCallShiftDto[]>([]);
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestDto[]>([]);
  const [scheduleName, setScheduleName] = useState("");
  const [startTime, setStartTime] = useState(() => toInputDateTime(new Date()));
  const [swapTargets, setSwapTargets] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const activeMembers = useMemo(
    () => members.filter((member) => member.isActive),
    [members],
  );

  async function loadSchedules() {
    const loadedSchedules = await getTeamSchedules(teamId);
    setSchedules(loadedSchedules);
    setSelectedScheduleId(
      (existing) => existing || loadedSchedules[0]?.id || "",
    );
    return loadedSchedules;
  }

  async function loadScheduleData(scheduleId: string) {
    if (!scheduleId) {
      setShifts([]);
      return;
    }

    setShifts(await getScheduleShifts(scheduleId));
  }

  async function loadSwapRequests() {
    if (!canManage) {
      setSwapRequests([]);
      return;
    }

    setSwapRequests(await getTeamSwapRequests(teamId));
  }

  async function loadAll() {
    try {
      setError(null);
      const loadedSchedules = await loadSchedules();
      const scheduleId = selectedScheduleId || loadedSchedules[0]?.id || "";
      await loadScheduleData(scheduleId);
      await loadSwapRequests();
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load schedule data.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, canManage]);

  useEffect(() => {
    void Promise.resolve().then(() => loadScheduleData(selectedScheduleId));
  }, [selectedScheduleId]);

  async function handleCreateSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const schedule = await createSchedule({
        teamId,
        name: scheduleName.trim(),
        frequency: ScheduleFrequency.Daily,
        startTimeUtc: new Date(startTime).toISOString(),
        durationMinutes: 1440,
      });
      await generateScheduleShifts(schedule.id, { count: 8 });
      setScheduleName("");
      setSelectedScheduleId(schedule.id);
      setSuccess("Schedule created and shifts generated.");
      await loadAll();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create schedule.",
      );
    }
  }

  async function handleGenerateShifts() {
    if (!selectedScheduleId) {
      return;
    }

    try {
      setError(null);
      setShifts(await generateScheduleShifts(selectedScheduleId, { count: 8 }));
      setSuccess("Shifts generated.");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate shifts.",
      );
    }
  }

  async function handleRequestSwap(shift: OnCallShiftDto) {
    const targetUserId = swapTargets[shift.id];
    if (!targetUserId) {
      setError("Select a swap target.");
      return;
    }

    try {
      setError(null);
      await createSwapRequest(shift.id, { targetUserId, requesterNote: "" });
      setSuccess("Swap request submitted.");
      await loadScheduleData(selectedScheduleId);
      await loadSwapRequests();
    } catch (swapError) {
      setError(
        swapError instanceof Error
          ? swapError.message
          : "Failed to request swap.",
      );
    }
  }

  async function handleApprove(swapRequestId: string) {
    try {
      setError(null);
      await approveSwapRequest(swapRequestId, { decisionNote: "" });
      setSuccess("Swap approved.");
      await loadScheduleData(selectedScheduleId);
      await loadSwapRequests();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Failed to approve swap.",
      );
    }
  }

  async function handleReject(swapRequestId: string) {
    try {
      setError(null);
      await rejectSwapRequest(swapRequestId, { decisionNote: "" });
      setSuccess("Swap rejected.");
      await loadScheduleData(selectedScheduleId);
      await loadSwapRequests();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "Failed to reject swap.",
      );
    }
  }

  const pendingSwapRequests = swapRequests.filter(
    (request) => request.status === ShiftSwapRequestStatus.Pending,
  );

  return (
    <div className="card shadow mt-4">
      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <h2 className="h5 mb-0">Schedule</h2>
        {canManage && selectedScheduleId ? (
          <button
            className="btn btn-light btn-sm"
            onClick={() => void handleGenerateShifts()}
            type="button"
          >
            Generate Shifts
          </button>
        ) : null}
      </div>
      <div className="card-body">
        {isLoading ? <p className="text-muted">Loading schedule...</p> : null}
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        {success ? (
          <div className="alert alert-success" role="status">
            {success}
          </div>
        ) : null}

        {canManage ? (
          <form
            className="row g-2 align-items-end mb-4"
            onSubmit={handleCreateSchedule}
          >
            <div className="col-md-5">
              <label className="form-label" htmlFor="scheduleName">
                Schedule name
              </label>
              <input
                className="form-control"
                id="scheduleName"
                onChange={(event) => setScheduleName(event.target.value)}
                required
                value={scheduleName}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="scheduleStart">
                Start time
              </label>
              <input
                className="form-control"
                id="scheduleStart"
                onChange={(event) => setStartTime(event.target.value)}
                type="datetime-local"
                value={startTime}
              />
            </div>
            <div className="col-md-3">
              <button className="btn btn-primary w-100" type="submit">
                Create Schedule
              </button>
            </div>
          </form>
        ) : null}

        {schedules.length > 1 ? (
          <div className="mb-3">
            <label className="form-label" htmlFor="scheduleSelect">
              Active schedule
            </label>
            <select
              className="form-select"
              id="scheduleSelect"
              onChange={(event) => setSelectedScheduleId(event.target.value)}
              value={selectedScheduleId}
            >
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {shifts.length === 0 ? (
          <p className="text-muted mb-0">No shifts generated yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Start</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Swap</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift, index) => {
                  const canRequestSwap =
                    currentUserId === shift.userId &&
                    !shift.hasPendingSwapRequest;
                  const targetMembers = activeMembers.filter(
                    (member) => member.userId !== shift.userId,
                  );

                  return (
                    <tr key={shift.id}>
                      <td>{formatDateTime(shift.startTimeUtc)}</td>
                      <td>{shift.userFullName ?? shift.userId}</td>
                      <td>
                        {shift.hasPendingSwapRequest
                          ? `Pending swap to ${shift.pendingSwapTargetUserFullName ?? shift.pendingSwapTargetUserId}`
                          : shift.isSwapped
                            ? "Swapped"
                            : "Scheduled"}
                      </td>
                      <td>
                        {canRequestSwap ? (
                          <div className="d-flex gap-2">
                            <label
                              className="visually-hidden"
                              htmlFor={`swapTarget-${shift.id}`}
                            >
                              Swap target
                            </label>
                            <select
                              aria-label="Swap target"
                              className="form-select form-select-sm"
                              id={`swapTarget-${shift.id}`}
                              onChange={(event) =>
                                setSwapTargets((current) => ({
                                  ...current,
                                  [shift.id]: event.target.value,
                                }))
                              }
                              value={swapTargets[shift.id] ?? ""}
                            >
                              <option value="">Select member</option>
                              {targetMembers.map((member) => (
                                <option
                                  key={member.userId}
                                  value={member.userId}
                                >
                                  {member.userFullName ?? member.userId}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => void handleRequestSwap(shift)}
                              type="button"
                            >
                              Request Swap
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted small">
                            {index === 0 && currentUserId
                              ? "No action available"
                              : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canManage ? (
          <div className="mt-4">
            <h3 className="h6">Pending Swap Requests</h3>
            {pendingSwapRequests.length === 0 ? (
              <p className="text-muted mb-0">No pending swap requests.</p>
            ) : (
              <div className="list-group">
                {pendingSwapRequests.map((request) => (
                  <div
                    className="list-group-item d-flex justify-content-between align-items-center"
                    key={request.id}
                  >
                    <div>
                      <strong>
                        {request.requestedByUserFullName ??
                          request.requestedByUserId}{" "}
                        to {request.targetUserFullName ?? request.targetUserId}
                      </strong>
                      <div className="text-muted small">
                        {formatDateTime(request.shiftStartTimeUtc)}
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => void handleApprove(request.id)}
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => void handleReject(request.id)}
                        type="button"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
