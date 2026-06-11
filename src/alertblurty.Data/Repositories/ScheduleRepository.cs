using Microsoft.EntityFrameworkCore;
using alertblurty.Data.Entities;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;
using DataSwapStatus = alertblurty.Data.Entities.ShiftSwapRequestStatus;
using ModelSwapStatus = alertblurty.Models.DTOs.ShiftSwapRequestStatus;

namespace alertblurty.Data.Repositories;

public class ScheduleRepository : IScheduleRepository
{
    private readonly AlertBlurtyDbContext _context;

    public ScheduleRepository(AlertBlurtyDbContext context)
    {
        _context = context;
    }

    public async Task<OnCallScheduleDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var schedule = await _context.OnCallSchedules
            .Include(s => s.Team)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        return schedule == null ? null : MapScheduleToDto(schedule);
    }

    public async Task<List<OnCallScheduleDto>> GetByTeamIdAsync(Guid teamId, CancellationToken cancellationToken = default)
    {
        var schedules = await _context.OnCallSchedules
            .Include(s => s.Team)
            .Where(s => s.TeamId == teamId)
            .ToListAsync(cancellationToken);

        return schedules.Select(MapScheduleToDto).ToList();
    }

    public async Task<List<OnCallScheduleDto>> GetActiveSchedulesAsync(CancellationToken cancellationToken = default)
    {
        var schedules = await _context.OnCallSchedules
            .Include(s => s.Team)
            .Where(s => s.IsActive)
            .ToListAsync(cancellationToken);

        return schedules.Select(MapScheduleToDto).ToList();
    }

    public async Task<OnCallScheduleDto> CreateAsync(OnCallScheduleDto scheduleDto, CancellationToken cancellationToken = default)
    {
        var schedule = new OnCallSchedule
        {
            Id = Guid.NewGuid(),
            TeamId = scheduleDto.TeamId,
            Name = scheduleDto.Name,
            Frequency = (Entities.ScheduleFrequency)scheduleDto.Frequency,
            StartTimeUtc = scheduleDto.StartTimeUtc,
            DurationMinutes = scheduleDto.DurationMinutes,
            IsActive = true
        };

        _context.OnCallSchedules.Add(schedule);
        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(schedule.Id, cancellationToken) ?? throw new InvalidOperationException("Failed to retrieve created schedule");
    }

    public async Task<OnCallScheduleDto> UpdateAsync(OnCallScheduleDto scheduleDto, CancellationToken cancellationToken = default)
    {
        var schedule = await _context.OnCallSchedules.FindAsync(new object[] { scheduleDto.Id }, cancellationToken)
            ?? throw new KeyNotFoundException($"Schedule with ID {scheduleDto.Id} not found");

        schedule.Name = scheduleDto.Name;
        schedule.Frequency = (Entities.ScheduleFrequency)scheduleDto.Frequency;
        schedule.StartTimeUtc = scheduleDto.StartTimeUtc;
        schedule.DurationMinutes = scheduleDto.DurationMinutes;
        schedule.IsActive = scheduleDto.IsActive;

        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(schedule.Id, cancellationToken) ?? throw new InvalidOperationException("Failed to retrieve updated schedule");
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var schedule = await _context.OnCallSchedules.FindAsync(new object[] { id }, cancellationToken)
            ?? throw new KeyNotFoundException($"Schedule with ID {id} not found");

        _context.OnCallSchedules.Remove(schedule);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<OnCallShiftDto>> GenerateShiftsAsync(Guid scheduleId, int count, CancellationToken cancellationToken = default)
    {
        if (count <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(count), "Shift count must be greater than zero.");
        }

        var schedule = await _context.OnCallSchedules
            .Include(entity => entity.Team)
            .ThenInclude(team => team.Members)
            .ThenInclude(member => member.User)
            .Include(entity => entity.Shifts)
            .FirstOrDefaultAsync(entity => entity.Id == scheduleId, cancellationToken)
            ?? throw new KeyNotFoundException($"Schedule with ID {scheduleId} not found");

        var members = schedule.Team.Members
            .Where(member => member.IsActive)
            .OrderBy(member => member.RotationOrder)
            .ThenBy(member => member.CreatedAtUtc)
            .ToList();

        if (members.Count == 0)
        {
            throw new InvalidOperationException("Team has no active members.");
        }

        if (schedule.Shifts.Count != 0)
        {
            _context.OnCallShifts.RemoveRange(schedule.Shifts);
        }

        var shifts = Enumerable.Range(0, count)
            .Select(index =>
            {
                var start = AddPeriods(schedule.StartTimeUtc, schedule.Frequency, index, schedule.DurationMinutes);
                return new OnCallShift
                {
                    Id = Guid.NewGuid(),
                    ScheduleId = schedule.Id,
                    UserId = members[index % members.Count].UserId,
                    StartTimeUtc = start,
                    EndTimeUtc = start.AddMinutes(schedule.DurationMinutes),
                    IsSwapped = false
                };
            })
            .ToList();

        _context.OnCallShifts.AddRange(shifts);
        await _context.SaveChangesAsync(cancellationToken);

        return await GetShiftsByScheduleIdAsync(schedule.Id, cancellationToken);
    }

    public async Task<OnCallShiftDto?> GetCurrentShiftAsync(Guid teamId, DateTime currentTime, CancellationToken cancellationToken = default)
    {
        var shift = await _context.OnCallShifts
            .Include(s => s.User)
            .Include(s => s.Schedule)
            .Include(s => s.SwapRequests)
            .ThenInclude(request => request.TargetUser)
            .Where(s => s.Schedule.TeamId == teamId
                && s.StartTimeUtc <= currentTime
                && s.EndTimeUtc > currentTime)
            .FirstOrDefaultAsync(cancellationToken);

        return shift == null ? null : MapShiftToDto(shift);
    }

    public async Task<List<OnCallShiftDto>> GetShiftsByScheduleIdAsync(Guid scheduleId, CancellationToken cancellationToken = default)
    {
        var shifts = await _context.OnCallShifts
            .Include(s => s.User)
            .Include(s => s.SwappedWithUser)
            .Include(s => s.ApprovedByUser)
            .Include(s => s.Schedule)
            .Include(s => s.SwapRequests)
            .ThenInclude(request => request.TargetUser)
            .Where(s => s.ScheduleId == scheduleId)
            .OrderBy(s => s.StartTimeUtc)
            .ToListAsync(cancellationToken);

        return shifts.Select(MapShiftToDto).ToList();
    }

    public async Task<ShiftSwapRequestDto> CreateSwapRequestAsync(Guid shiftId, Guid requestedByUserId, Guid targetUserId, string requesterNote, CancellationToken cancellationToken = default)
    {
        var shift = await LoadShiftForSwapAsync(shiftId, cancellationToken);

        if (shift.UserId != requestedByUserId)
        {
            throw new InvalidOperationException("Only the assigned user can request a swap for this shift.");
        }

        if (requestedByUserId == targetUserId)
        {
            throw new InvalidOperationException("Target user must be different from the assigned user.");
        }

        var targetIsActiveMember = await _context.TeamMembers.AnyAsync(
            member => member.TeamId == shift.Schedule.TeamId
                && member.UserId == targetUserId
                && member.IsActive,
            cancellationToken);

        if (!targetIsActiveMember)
        {
            throw new InvalidOperationException("Target user must be an active member of the team.");
        }

        var hasPendingRequest = await _context.ShiftSwapRequests.AnyAsync(
            request => request.ShiftId == shiftId && request.Status == DataSwapStatus.Pending,
            cancellationToken);

        if (hasPendingRequest)
        {
            throw new InvalidOperationException("This shift already has a pending swap request.");
        }

        var requiresApproval = shift.Schedule.Team.RequireAdminApprovalForSwaps;
        var swap = new ShiftSwapRequest
        {
            Id = Guid.NewGuid(),
            ShiftId = shift.Id,
            RequestedByUserId = requestedByUserId,
            TargetUserId = targetUserId,
            Status = requiresApproval ? DataSwapStatus.Pending : DataSwapStatus.Applied,
            RequiresApprovalSnapshot = requiresApproval,
            RequestedAtUtc = DateTime.UtcNow,
            RequesterNote = requesterNote.Trim()
        };

        if (!requiresApproval)
        {
            ApplySwap(shift, requestedByUserId, targetUserId, approvedByUserId: null);
            swap.DecidedAtUtc = DateTime.UtcNow;
        }

        _context.ShiftSwapRequests.Add(swap);
        await _context.SaveChangesAsync(cancellationToken);

        return await GetSwapRequestByIdAsync(swap.Id, cancellationToken);
    }

    public async Task<ShiftSwapRequestDto> ApproveSwapRequestAsync(Guid swapRequestId, Guid decidedByUserId, string decisionNote, CancellationToken cancellationToken = default)
    {
        var swap = await LoadSwapRequestForDecisionAsync(swapRequestId, cancellationToken);

        if (swap.Status != DataSwapStatus.Pending)
        {
            throw new InvalidOperationException("Only pending swap requests can be approved.");
        }

        ApplySwap(swap.Shift, swap.RequestedByUserId, swap.TargetUserId, decidedByUserId);
        swap.Status = DataSwapStatus.Approved;
        swap.DecidedAtUtc = DateTime.UtcNow;
        swap.DecidedByUserId = decidedByUserId;
        swap.DecisionNote = decisionNote.Trim();

        await _context.SaveChangesAsync(cancellationToken);
        return await GetSwapRequestByIdAsync(swap.Id, cancellationToken);
    }

    public async Task<ShiftSwapRequestDto> RejectSwapRequestAsync(Guid swapRequestId, Guid decidedByUserId, string decisionNote, CancellationToken cancellationToken = default)
    {
        var swap = await LoadSwapRequestForDecisionAsync(swapRequestId, cancellationToken);

        if (swap.Status != DataSwapStatus.Pending)
        {
            throw new InvalidOperationException("Only pending swap requests can be rejected.");
        }

        swap.Status = DataSwapStatus.Rejected;
        swap.DecidedAtUtc = DateTime.UtcNow;
        swap.DecidedByUserId = decidedByUserId;
        swap.DecisionNote = decisionNote.Trim();

        await _context.SaveChangesAsync(cancellationToken);
        return await GetSwapRequestByIdAsync(swap.Id, cancellationToken);
    }

    public async Task<List<ShiftSwapRequestDto>> GetSwapRequestsByTeamIdAsync(Guid teamId, CancellationToken cancellationToken = default)
    {
        var requests = await _context.ShiftSwapRequests
            .Include(request => request.Shift)
            .ThenInclude(shift => shift.Schedule)
            .Include(request => request.RequestedByUser)
            .Include(request => request.TargetUser)
            .Include(request => request.DecidedByUser)
            .Where(request => request.Shift.Schedule.TeamId == teamId)
            .OrderByDescending(request => request.RequestedAtUtc)
            .ToListAsync(cancellationToken);

        return requests.Select(MapSwapRequestToDto).ToList();
    }

    private static OnCallScheduleDto MapScheduleToDto(OnCallSchedule schedule)
    {
        return new OnCallScheduleDto
        {
            Id = schedule.Id,
            TeamId = schedule.TeamId,
            Name = schedule.Name,
            Frequency = (Models.DTOs.ScheduleFrequency)schedule.Frequency,
            StartTimeUtc = schedule.StartTimeUtc,
            DurationMinutes = schedule.DurationMinutes,
            IsActive = schedule.IsActive,
            CreatedAtUtc = schedule.CreatedAtUtc,
            UpdatedAtUtc = schedule.UpdatedAtUtc,
            TeamName = schedule.Team?.Name
        };
    }

    private static OnCallShiftDto MapShiftToDto(OnCallShift shift)
    {
        var pendingSwap = shift.SwapRequests
            .Where(request => request.Status == DataSwapStatus.Pending)
            .OrderByDescending(request => request.RequestedAtUtc)
            .FirstOrDefault();

        return new OnCallShiftDto
        {
            Id = shift.Id,
            ScheduleId = shift.ScheduleId,
            UserId = shift.UserId,
            StartTimeUtc = shift.StartTimeUtc,
            EndTimeUtc = shift.EndTimeUtc,
            IsSwapped = shift.IsSwapped,
            SwappedWithUserId = shift.SwappedWithUserId,
            ApprovedByUserId = shift.ApprovedByUserId,
            HasPendingSwapRequest = pendingSwap != null,
            PendingSwapRequestId = pendingSwap?.Id,
            PendingSwapTargetUserId = pendingSwap?.TargetUserId,
            CreatedAtUtc = shift.CreatedAtUtc,
            UpdatedAtUtc = shift.UpdatedAtUtc,
            UserFullName = shift.User?.FullName,
            SwappedWithUserFullName = shift.SwappedWithUser?.FullName,
            ApprovedByUserFullName = shift.ApprovedByUser?.FullName,
            PendingSwapTargetUserFullName = pendingSwap?.TargetUser?.FullName,
            ScheduleName = shift.Schedule?.Name
        };
    }

    private async Task<OnCallShift> LoadShiftForSwapAsync(Guid shiftId, CancellationToken cancellationToken)
    {
        return await _context.OnCallShifts
            .Include(shift => shift.Schedule)
            .ThenInclude(schedule => schedule.Team)
            .FirstOrDefaultAsync(shift => shift.Id == shiftId, cancellationToken)
            ?? throw new KeyNotFoundException($"Shift with ID {shiftId} not found");
    }

    private async Task<ShiftSwapRequest> LoadSwapRequestForDecisionAsync(Guid swapRequestId, CancellationToken cancellationToken)
    {
        return await _context.ShiftSwapRequests
            .Include(request => request.Shift)
            .ThenInclude(shift => shift.Schedule)
            .ThenInclude(schedule => schedule.Team)
            .FirstOrDefaultAsync(request => request.Id == swapRequestId, cancellationToken)
            ?? throw new KeyNotFoundException($"Swap request with ID {swapRequestId} not found");
    }

    private async Task<ShiftSwapRequestDto> GetSwapRequestByIdAsync(Guid swapRequestId, CancellationToken cancellationToken)
    {
        var request = await _context.ShiftSwapRequests
            .Include(entity => entity.Shift)
            .ThenInclude(shift => shift.Schedule)
            .Include(entity => entity.RequestedByUser)
            .Include(entity => entity.TargetUser)
            .Include(entity => entity.DecidedByUser)
            .FirstAsync(entity => entity.Id == swapRequestId, cancellationToken);

        return MapSwapRequestToDto(request);
    }

    private static ShiftSwapRequestDto MapSwapRequestToDto(ShiftSwapRequest request)
    {
        return new ShiftSwapRequestDto
        {
            Id = request.Id,
            ShiftId = request.ShiftId,
            ScheduleId = request.Shift.ScheduleId,
            TeamId = request.Shift.Schedule.TeamId,
            RequestedByUserId = request.RequestedByUserId,
            TargetUserId = request.TargetUserId,
            Status = (ModelSwapStatus)request.Status,
            RequiresApprovalSnapshot = request.RequiresApprovalSnapshot,
            RequestedAtUtc = request.RequestedAtUtc,
            DecidedAtUtc = request.DecidedAtUtc,
            DecidedByUserId = request.DecidedByUserId,
            RequesterNote = request.RequesterNote,
            DecisionNote = request.DecisionNote,
            CreatedAtUtc = request.CreatedAtUtc,
            UpdatedAtUtc = request.UpdatedAtUtc,
            RequestedByUserFullName = request.RequestedByUser?.FullName,
            TargetUserFullName = request.TargetUser?.FullName,
            DecidedByUserFullName = request.DecidedByUser?.FullName,
            ShiftStartTimeUtc = request.Shift.StartTimeUtc,
            ShiftEndTimeUtc = request.Shift.EndTimeUtc
        };
    }

    private static void ApplySwap(OnCallShift shift, Guid previousUserId, Guid targetUserId, Guid? approvedByUserId)
    {
        shift.UserId = targetUserId;
        shift.IsSwapped = true;
        shift.SwappedWithUserId = previousUserId;
        shift.ApprovedByUserId = approvedByUserId;
    }

    private static DateTime AddPeriods(DateTime start, Entities.ScheduleFrequency frequency, int index, int durationMinutes)
    {
        return frequency switch
        {
            Entities.ScheduleFrequency.Hourly => start.AddHours(index),
            Entities.ScheduleFrequency.Daily => start.AddDays(index),
            Entities.ScheduleFrequency.Weekly => start.AddDays(index * 7),
            Entities.ScheduleFrequency.Monthly => start.AddMonths(index),
            _ => start.AddMinutes(durationMinutes * index)
        };
    }
}
