namespace alertblurty.Data.Entities;

public class OnCallSchedule : BaseEntity
{
    public Guid TeamId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ScheduleFrequency Frequency { get; set; }
    public DateTime StartTimeUtc { get; set; }
    public int DurationMinutes { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public Team Team { get; set; } = null!;
    public ICollection<OnCallShift> Shifts { get; set; } = new List<OnCallShift>();
}

public enum ScheduleFrequency
{
    Hourly = 0,
    Daily = 1,
    Weekly = 2,
    Monthly = 3
}
