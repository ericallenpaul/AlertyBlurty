using Microsoft.AspNetCore.Mvc;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;
using alertblurty.Models.Requests.Incidents;
using System.Security.Claims;

namespace alertblurty.Api.Endpoints;

public static class IncidentEndpoints
{
    public static void MapIncidentEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/incidents")
            .WithTags("Incidents")
            .RequireAuthorization();

        group.MapGet("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromServices] IIncidentRepository incidentRepository,
            CancellationToken cancellationToken) =>
        {
            var incident = await incidentRepository.GetByIdAsync(id, cancellationToken);
            return incident != null
                ? Results.Ok(incident)
                : Results.NotFound();
        })
        .WithName("GetIncidentById")
        .WithOpenApi();

        group.MapGet("/team/{teamId:guid}", async (
            [FromRoute] Guid teamId,
            [FromQuery] IncidentStatus? status,
            [FromServices] IIncidentRepository incidentRepository,
            CancellationToken cancellationToken) =>
        {
            var incidents = await incidentRepository.GetByTeamIdAsync(teamId, status, cancellationToken);
            return Results.Ok(incidents);
        })
        .WithName("GetIncidentsByTeam")
        .WithOpenApi();

        group.MapGet("/open", async (
            [FromServices] IIncidentRepository incidentRepository,
            CancellationToken cancellationToken) =>
        {
            var incidents = await incidentRepository.GetOpenIncidentsAsync(cancellationToken);
            return Results.Ok(incidents);
        })
        .WithName("GetOpenIncidents")
        .WithOpenApi();

        group.MapPost("/{id:guid}/acknowledge", async (
            [FromRoute] Guid id,
            ClaimsPrincipal user,
            [FromServices] IIncidentService incidentService,
            CancellationToken cancellationToken) =>
        {
            var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Results.Unauthorized();
            }

            try
            {
                var incident = await incidentService.AcknowledgeIncidentAsync(id, userId, cancellationToken);
                return Results.Ok(incident);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        })
        .WithName("AcknowledgeIncident")
        .WithOpenApi();
    }
}
