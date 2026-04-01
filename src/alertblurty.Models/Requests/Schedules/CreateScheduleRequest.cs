using alertblurty.Models.DTOs;

namespace alertblurty.Models.Requests.Schedules;

public class CreateScheduleRequest
{
    public Guid TeamId { get; set; }
    public string Name { get; set; } = string.Empty;
    public ScheduleFrequency Frequency { get; set; }
    public DateTime StartTimeUtc { get; set; }
    public int DurationMinutes { get; set; }
}
