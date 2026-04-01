namespace alertblurty.Data.Entities;

public class IncidentNotification : BaseEntity
{
    public Guid IncidentId { get; set; }
    public Guid UserId { get; set; }
    public NotificationMethod Method { get; set; }
    public string Recipient { get; set; } = string.Empty; // Phone number for SMS
    public NotificationStatus Status { get; set; }
    public DateTime SentAtUtc { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }
    public string TwilioMessageSid { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }
    public int AttemptNumber { get; set; } = 1;

    // Navigation properties
    public Incident Incident { get; set; } = null!;
    public User User { get; set; } = null!;
}

public enum NotificationMethod
{
    SMS = 0
    // Future: Email, Voice, Push, etc.
}

public enum NotificationStatus
{
    Pending = 0,
    Sent = 1,
    Delivered = 2,
    Failed = 3
}
