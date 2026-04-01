namespace alertblurty.Models.DTOs;

public class IncidentDto : BaseDto
{
    public Guid TeamId { get; set; }
    public string ZabbixEventId { get; set; } = string.Empty;
    public string ZabbixTriggerId { get; set; } = string.Empty;
    public string HostName { get; set; } = string.Empty;
    public string TriggerName { get; set; } = string.Empty;
    public string TriggerDescription { get; set; } = string.Empty;
    public int Severity { get; set; }
    public DateTime FirstOccurrenceUtc { get; set; }
    public DateTime LastOccurrenceUtc { get; set; }
    public int EventCount { get; set; }
    public IncidentStatus Status { get; set; }
    public Guid? AcknowledgedByUserId { get; set; }
    public DateTime? AcknowledgedAtUtc { get; set; }

    // Navigation
    public string? TeamName { get; set; }
    public string? AcknowledgedByUserName { get; set; }
}

public enum IncidentStatus
{
    Open = 0,
    Acknowledged = 1,
    Resolved = 2
}
