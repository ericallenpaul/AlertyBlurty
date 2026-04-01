using Microsoft.AspNetCore.Mvc;
using alertblurty.Models.Interfaces;
using alertblurty.Models.Requests.Incidents;

namespace alertblurty.Api.Endpoints;

public static class WebhookEndpoints
{
    public static void MapWebhookEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/webhooks")
            .WithTags("Webhooks");

        group.MapPost("/zabbix/{teamId:guid}", async (
            [FromRoute] Guid teamId,
            [FromBody] ZabbixWebhookRequest request,
            [FromServices] IIncidentService incidentService,
            [FromServices] ILogger<Program> logger,
            CancellationToken cancellationToken) =>
        {
            try
            {
                logger.LogInformation(
                    "Received Zabbix webhook for team {TeamId}: Event={EventId}, Host={HostName}, Trigger={TriggerName}, Status={Status}",
                    teamId, request.EventId, request.HostName, request.TriggerName, request.Status);

                var incident = await incidentService.ProcessZabbixWebhookAsync(request, teamId, cancellationToken);

                logger.LogInformation(
                    "Processed Zabbix webhook. Incident {IncidentId} status: {Status}",
                    incident.Id, incident.Status);

                return Results.Ok(new
                {
                    success = true,
                    incidentId = incident.Id,
                    status = incident.Status.ToString(),
                    message = "Webhook processed successfully"
                });
            }
            catch (InvalidOperationException ex)
            {
                logger.LogWarning(ex, "Failed to process Zabbix webhook for team {TeamId}", teamId);
                return Results.Ok(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing Zabbix webhook for team {TeamId}", teamId);
                return Results.Problem(
                    title: "Webhook Processing Error",
                    detail: ex.Message,
                    statusCode: 500);
            }
        })
        .WithName("ZabbixWebhook")
        .WithOpenApi()
        .AllowAnonymous(); // Zabbix webhooks don't use JWT authentication
    }
}
