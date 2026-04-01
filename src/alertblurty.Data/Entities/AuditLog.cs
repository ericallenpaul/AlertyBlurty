namespace alertblurty.Data.Entities;

public class AuditLog : BaseEntity
{
    public Guid? UserId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public Guid? EntityId { get; set; }
    public string? Details { get; set; } // JSON
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }

    // Navigation properties
    public User? User { get; set; }
}
