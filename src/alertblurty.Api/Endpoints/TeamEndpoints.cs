using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using alertblurty.Models.Interfaces;
using alertblurty.Models.Requests.Teams;

namespace alertblurty.Api.Endpoints;

public static class TeamEndpoints
{
    public static void MapTeamEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/teams")
            .WithTags("Teams")
            .RequireAuthorization();

        group.MapGet("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromServices] ITeamRepository teamRepository,
            CancellationToken cancellationToken) =>
        {
            var team = await teamRepository.GetByIdAsync(id, true, cancellationToken);
            return team != null
                ? Results.Ok(team)
                : Results.NotFound();
        })
        .WithName("GetTeamById")
        .WithOpenApi();

        group.MapGet("/organization/{organizationId:guid}", async (
            [FromRoute] Guid organizationId,
            [FromServices] ITeamRepository teamRepository,
            CancellationToken cancellationToken) =>
        {
            var teams = await teamRepository.GetByOrganizationIdAsync(organizationId, cancellationToken);
            return Results.Ok(teams);
        })
        .WithName("GetTeamsByOrganization")
        .WithOpenApi();

        group.MapPost("/", async (
            [FromBody] CreateTeamRequest request,
            ClaimsPrincipal user,
            [FromServices] ITeamRepository teamRepository,
            [FromServices] IUserRepository userRepository,
            CancellationToken cancellationToken) =>
        {
            var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Results.Unauthorized();
            }

            var currentUser = await userRepository.GetByIdAsync(userId, cancellationToken);
            if (currentUser == null)
            {
                return Results.Unauthorized();
            }

            var teamDto = new Models.DTOs.TeamDto
            {
                OrganizationId = currentUser.OrganizationId,
                Name = request.Name,
                Description = request.Description,
                RequireAdminApprovalForSwaps = request.RequireAdminApprovalForSwaps
            };

            var createdTeam = await teamRepository.CreateAsync(teamDto, cancellationToken);
            return Results.Created($"/api/teams/{createdTeam.Id}", createdTeam);
        })
        .WithName("CreateTeam")
        .WithOpenApi()
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        group.MapPut("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromBody] UpdateTeamRequest request,
            [FromServices] ITeamRepository teamRepository,
            CancellationToken cancellationToken) =>
        {
            var teamDto = await teamRepository.GetByIdAsync(id, false, cancellationToken);
            if (teamDto == null)
            {
                return Results.NotFound();
            }

            if (request.Name != null) teamDto.Name = request.Name;
            if (request.Description != null) teamDto.Description = request.Description;
            if (request.RequireAdminApprovalForSwaps.HasValue)
                teamDto.RequireAdminApprovalForSwaps = request.RequireAdminApprovalForSwaps.Value;

            var updatedTeam = await teamRepository.UpdateAsync(teamDto, cancellationToken);
            return Results.Ok(updatedTeam);
        })
        .WithName("UpdateTeam")
        .WithOpenApi()
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        group.MapDelete("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromServices] ITeamRepository teamRepository,
            CancellationToken cancellationToken) =>
        {
            await teamRepository.DeleteAsync(id, cancellationToken);
            return Results.NoContent();
        })
        .WithName("DeleteTeam")
        .WithOpenApi()
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        // Team members endpoints
        group.MapGet("/{teamId:guid}/members", async (
            [FromRoute] Guid teamId,
            [FromServices] ITeamRepository teamRepository,
            CancellationToken cancellationToken) =>
        {
            var members = await teamRepository.GetTeamMembersAsync(teamId, cancellationToken);
            return Results.Ok(members);
        })
        .WithName("GetTeamMembers")
        .WithOpenApi();

        group.MapPost("/{teamId:guid}/members", async (
            [FromRoute] Guid teamId,
            [FromBody] AddTeamMemberRequest request,
            [FromServices] ITeamRepository teamRepository,
            CancellationToken cancellationToken) =>
        {
            var memberDto = new Models.DTOs.TeamMemberDto
            {
                TeamId = teamId,
                UserId = request.UserId,
                RotationOrder = request.RotationOrder,
                IsActive = true
            };

            var createdMember = await teamRepository.AddMemberAsync(memberDto, cancellationToken);
            return Results.Created($"/api/teams/{teamId}/members", createdMember);
        })
        .WithName("AddTeamMember")
        .WithOpenApi()
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        group.MapDelete("/{teamId:guid}/members/{userId:guid}", async (
            [FromRoute] Guid teamId,
            [FromRoute] Guid userId,
            [FromServices] ITeamRepository teamRepository,
            CancellationToken cancellationToken) =>
        {
            await teamRepository.RemoveMemberAsync(teamId, userId, cancellationToken);
            return Results.NoContent();
        })
        .WithName("RemoveTeamMember")
        .WithOpenApi()
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));
    }
}
