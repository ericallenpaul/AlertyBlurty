namespace alertblurty.Data.Entities;

public class IncidentAcknowledgment : BaseEntity
{
    public Guid IncidentId { get; set; }
    public Guid UserId { get; set; }
    public DateTime AcknowledgedAtUtc { get; set; }
    public bool ZabbixAckSuccess { get; set; }
    public string? ZabbixAckResponse { get; set; }

    // Navigation properties
    public Incident Incident { get; set; } = null!;
    public User User { get; set; } = null!;
}
