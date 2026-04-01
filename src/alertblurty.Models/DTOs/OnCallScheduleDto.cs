namespace alertblurty.Models.DTOs;

public class OnCallScheduleDto : BaseDto
{
    public Guid TeamId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ScheduleFrequency Frequency { get; set; }
    public DateTime StartTimeUtc { get; set; }
    public int DurationMinutes { get; set; }
    public bool IsActive { get; set; }

    // Navigation
    public string? TeamName { get; set; }
}

public enum ScheduleFrequency
{
    Hourly = 0,
    Daily = 1,
    Weekly = 2,
    Monthly = 3
}
