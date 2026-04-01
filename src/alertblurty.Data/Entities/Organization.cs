namespace alertblurty.Data.Entities;

public class Organization : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string DefaultTimezone { get; set; } = "UTC";
    public bool IsSetupComplete { get; set; } = false;

    // Navigation properties
    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Team> Teams { get; set; } = new List<Team>();
}
