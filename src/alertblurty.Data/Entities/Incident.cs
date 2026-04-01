namespace alertblurty.Data.Entities;

public class Incident : BaseEntity
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
    public int EventCount { get; set; } = 1;
    public IncidentStatus Status { get; set; } = IncidentStatus.Open;
    public Guid? AcknowledgedByUserId { get; set; }
    public DateTime? AcknowledgedAtUtc { get; set; }

    // Navigation properties
    public Team Team { get; set; } = null!;
    public User? AcknowledgedByUser { get; set; }
    public ICollection<IncidentNotification> Notifications { get; set; } = new List<IncidentNotification>();
    public ICollection<IncidentAcknowledgment> Acknowledgments { get; set; } = new List<IncidentAcknowledgment>();
}

public enum IncidentStatus
{
    Open = 0,
    Acknowledged = 1,
    Resolved = 2
}
