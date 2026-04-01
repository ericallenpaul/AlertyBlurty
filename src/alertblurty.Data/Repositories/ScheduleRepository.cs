using Microsoft.EntityFrameworkCore;
using alertblurty.Data.Entities;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;

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

    public async Task<OnCallShiftDto?> GetCurrentShiftAsync(Guid teamId, DateTime currentTime, CancellationToken cancellationToken = default)
    {
        var shift = await _context.OnCallShifts
            .Include(s => s.User)
            .Include(s => s.Schedule)
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
            .Where(s => s.ScheduleId == scheduleId)
            .OrderBy(s => s.StartTimeUtc)
            .ToListAsync(cancellationToken);

        return shifts.Select(MapShiftToDto).ToList();
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
            CreatedAtUtc = shift.CreatedAtUtc,
            UpdatedAtUtc = shift.UpdatedAtUtc,
            UserFullName = shift.User?.FullName,
            SwappedWithUserFullName = shift.SwappedWithUser?.FullName,
            ApprovedByUserFullName = shift.ApprovedByUser?.FullName,
            ScheduleName = shift.Schedule?.Name
        };
    }
}
