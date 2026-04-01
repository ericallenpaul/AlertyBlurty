namespace alertblurty.Models.DTOs;

public class IncidentNotificationDto : BaseDto
{
    public Guid IncidentId { get; set; }
    public Guid UserId { get; set; }
    public NotificationMethod Method { get; set; }
    public string Recipient { get; set; } = string.Empty;
    public NotificationStatus Status { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }
    public string TwilioMessageSid { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }
    public int AttemptNumber { get; set; }

    // Navigation
    public string? UserFullName { get; set; }
}

public enum NotificationMethod
{
    SMS = 0
}

public enum NotificationStatus
{
    Pending = 0,
    Sent = 1,
    Delivered = 2,
    Failed = 3
}
