namespace alertblurty.Models.DTOs;

public class IncidentAcknowledgmentDto : BaseDto
{
    public Guid IncidentId { get; set; }
    public Guid UserId { get; set; }
    public DateTime AcknowledgedAtUtc { get; set; }
    public bool ZabbixAckSuccess { get; set; }
    public string? ZabbixAckResponse { get; set; }

    // Navigation
    public string? UserFullName { get; set; }
    public string? IncidentTriggerName { get; set; }
}
