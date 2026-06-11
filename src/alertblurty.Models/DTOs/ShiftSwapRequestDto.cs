namespace alertblurty.Models.DTOs;

public class ShiftSwapRequestDto : BaseDto
{
    public Guid ShiftId { get; set; }
    public Guid ScheduleId { get; set; }
    public Guid TeamId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public Guid TargetUserId { get; set; }
    public ShiftSwapRequestStatus Status { get; set; }
    public bool RequiresApprovalSnapshot { get; set; }
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public string RequesterNote { get; set; } = string.Empty;
    public string DecisionNote { get; set; } = string.Empty;
    public string? RequestedByUserFullName { get; set; }
    public string? TargetUserFullName { get; set; }
    public string? DecidedByUserFullName { get; set; }
    public DateTime ShiftStartTimeUtc { get; set; }
    public DateTime ShiftEndTimeUtc { get; set; }
}

public enum ShiftSwapRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Applied = 3
}
