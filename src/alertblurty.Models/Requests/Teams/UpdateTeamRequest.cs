namespace alertblurty.Models.Requests.Teams;

public class UpdateTeamRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public bool? RequireAdminApprovalForSwaps { get; set; }
}
