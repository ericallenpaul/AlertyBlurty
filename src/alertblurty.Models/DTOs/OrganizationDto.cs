namespace alertblurty.Models.DTOs;

public class OrganizationDto : BaseDto
{
    public string Name { get; set; } = string.Empty;
    public string DefaultTimezone { get; set; } = string.Empty;
    public bool IsSetupComplete { get; set; }
}
