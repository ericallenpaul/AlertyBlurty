namespace alertblurty.Models.DTOs;

public class SystemConfigurationDto : BaseDto
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsEncrypted { get; set; }
}
