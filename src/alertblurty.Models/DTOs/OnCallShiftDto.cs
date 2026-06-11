namespace alertblurty.Models.DTOs;

public class OnCallShiftDto : BaseDto
{
    public Guid ScheduleId { get; set; }
    public Guid UserId { get; set; }
    public DateTime StartTimeUtc { get; set; }
    public DateTime EndTimeUtc { get; set; }
    public bool IsSwapped { get; set; }
    public Guid? SwappedWithUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }
    public bool HasPendingSwapRequest { get; set; }
    public Guid? PendingSwapRequestId { get; set; }
    public Guid? PendingSwapTargetUserId { get; set; }

    // Navigation
    public string? UserFullName { get; set; }
    public string? SwappedWithUserFullName { get; set; }
    public string? ApprovedByUserFullName { get; set; }
    public string? PendingSwapTargetUserFullName { get; set; }
    public string? ScheduleName { get; set; }
}
