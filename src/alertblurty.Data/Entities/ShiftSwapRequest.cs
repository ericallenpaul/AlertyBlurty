namespace alertblurty.Data.Entities;

public class ShiftSwapRequest : BaseEntity
{
    public Guid ShiftId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public Guid TargetUserId { get; set; }
    public ShiftSwapRequestStatus Status { get; set; } = ShiftSwapRequestStatus.Pending;
    public bool RequiresApprovalSnapshot { get; set; }
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public string RequesterNote { get; set; } = string.Empty;
    public string DecisionNote { get; set; } = string.Empty;

    public OnCallShift Shift { get; set; } = null!;
    public User RequestedByUser { get; set; } = null!;
    public User TargetUser { get; set; } = null!;
    public User? DecidedByUser { get; set; }
}

public enum ShiftSwapRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Applied = 3
}
