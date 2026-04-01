namespace alertblurty.Models.Requests.Teams;

public class CreateTeamRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool RequireAdminApprovalForSwaps { get; set; }
}
