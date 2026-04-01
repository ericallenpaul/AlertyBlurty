namespace alertblurty.Models.Requests.Incidents;

public class ZabbixWebhookRequest
{
    public string EventId { get; set; } = string.Empty;
    public string TriggerId { get; set; } = string.Empty;
    public string TriggerName { get; set; } = string.Empty;
    public string TriggerDescription { get; set; } = string.Empty;
    public string HostName { get; set; } = string.Empty;
    public int Severity { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime EventTime { get; set; }
}
