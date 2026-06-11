namespace alertblurty.Data.Entities;

public class OnCallShift : BaseEntity
{
    public Guid ScheduleId { get; set; }
    public Guid UserId { get; set; }
    public DateTime StartTimeUtc { get; set; }
    public DateTime EndTimeUtc { get; set; }
    public bool IsSwapped { get; set; } = false;
    public Guid? SwappedWithUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }

    // Navigation properties
    public OnCallSchedule Schedule { get; set; } = null!;
    public User User { get; set; } = null!;
    public User? SwappedWithUser { get; set; }
    public User? ApprovedByUser { get; set; }
    public ICollection<ShiftSwapRequest> SwapRequests { get; set; } = new List<ShiftSwapRequest>();
}
