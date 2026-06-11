namespace alertblurty.Models.Requests.Schedules;

public class CreateSwapRequest
{
    public Guid TargetUserId { get; set; }
    public string RequesterNote { get; set; } = string.Empty;
}
