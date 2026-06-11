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
    Task<List<OnCallShiftDto>> GenerateShiftsAsync(Guid scheduleId, int count, CancellationToken cancellationToken = default);
    Task<OnCallShiftDto?> GetCurrentShiftAsync(Guid teamId, DateTime currentTime, CancellationToken cancellationToken = default);
    Task<List<OnCallShiftDto>> GetShiftsByScheduleIdAsync(Guid scheduleId, CancellationToken cancellationToken = default);
    Task<ShiftSwapRequestDto> CreateSwapRequestAsync(Guid shiftId, Guid requestedByUserId, Guid targetUserId, string requesterNote, CancellationToken cancellationToken = default);
    Task<ShiftSwapRequestDto> ApproveSwapRequestAsync(Guid swapRequestId, Guid decidedByUserId, string decisionNote, CancellationToken cancellationToken = default);
    Task<ShiftSwapRequestDto> RejectSwapRequestAsync(Guid swapRequestId, Guid decidedByUserId, string decisionNote, CancellationToken cancellationToken = default);
    Task<List<ShiftSwapRequestDto>> GetSwapRequestsByTeamIdAsync(Guid teamId, CancellationToken cancellationToken = default);
}
