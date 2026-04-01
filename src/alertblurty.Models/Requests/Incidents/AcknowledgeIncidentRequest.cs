namespace alertblurty.Models.Requests.Incidents;

public class AcknowledgeIncidentRequest
{
    public Guid IncidentId { get; set; }
    public string? AcknowledgmentMessage { get; set; }
}
