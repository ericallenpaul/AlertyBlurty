namespace alertblurty.Models.Requests.Teams;

public class AddTeamMemberRequest
{
    public Guid UserId { get; set; }
    public int RotationOrder { get; set; }
}
