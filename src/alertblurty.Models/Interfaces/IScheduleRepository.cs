using alertblurty.Models.DTOs;

namespace alertblurty.Models.Interfaces;

public interface IScheduleRepository
{
    Task<OnCallScheduleDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<List<OnCallScheduleDto>> GetByTeamIdAsync(Guid teamId, CancellationToken cancellationToken = default);
    Task<List<OnCallScheduleDto>> GetActiveSchedulesAsync(CancellationToken cancellationToken = default);
    Task<OnCallScheduleDto> CreateAsync(OnCallScheduleDto schedule, CancellationToken cancellationToken = default);
    Task<OnCallScheduleDto> UpdateAsync(OnCallScheduleDto schedule, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<OnCallShiftDto?> GetCurrentShiftAsync(Guid teamId, DateTime currentTime, CancellationToken cancellationToken = default);
    Task<List<OnCallShiftDto>> GetShiftsByScheduleIdAsync(Guid scheduleId, CancellationToken cancellationToken = default);
}
