namespace alertblurty.Models.Requests.Schedules;

public class GenerateShiftsRequest
{
    public int? Count { get; set; }
    public DateTime? EndTimeUtc { get; set; }
}
