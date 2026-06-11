using System.Security.Claims;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;
using alertblurty.Models.Requests.Schedules;
using Microsoft.AspNetCore.Mvc;

namespace alertblurty.Api.Endpoints;

public static class ScheduleEndpoints
{
    public static void MapScheduleEndpoints(this IEndpointRouteBuilder app)
    {
        var schedules = app.MapGroup("/api/schedules")
            .WithTags("Schedules")
            .RequireAuthorization();

        schedules.MapGet("/team/{teamId:guid}", async (
            [FromRoute] Guid teamId,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var teamSchedules = await scheduleRepository.GetByTeamIdAsync(teamId, cancellationToken);
            return Results.Ok(teamSchedules);
        })
        .WithName("GetSchedulesByTeam");

        schedules.MapPost("/", async (
            [FromBody] CreateScheduleRequest request,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            if (request.DurationMinutes <= 0)
            {
                return Results.BadRequest(new { error = "Duration must be greater than zero." });
            }

            var schedule = await scheduleRepository.CreateAsync(new OnCallScheduleDto
            {
                TeamId = request.TeamId,
                Name = request.Name,
                Frequency = request.Frequency,
                StartTimeUtc = request.StartTimeUtc,
                DurationMinutes = request.DurationMinutes,
                IsActive = true
            }, cancellationToken);

            return Results.Created($"/api/schedules/{schedule.Id}", schedule);
        })
        .WithName("CreateSchedule")
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        schedules.MapGet("/{scheduleId:guid}/shifts", async (
            [FromRoute] Guid scheduleId,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var shifts = await scheduleRepository.GetShiftsByScheduleIdAsync(scheduleId, cancellationToken);
            return Results.Ok(shifts);
        })
        .WithName("GetScheduleShifts");

        schedules.MapPost("/{scheduleId:guid}/generate-shifts", async (
            [FromRoute] Guid scheduleId,
            [FromBody] GenerateShiftsRequest request,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var shifts = await scheduleRepository.GenerateShiftsAsync(scheduleId, request.Count, cancellationToken);
                return Results.Ok(shifts);
            }
            catch (Exception error) when (error is ArgumentOutOfRangeException or InvalidOperationException or KeyNotFoundException)
            {
                return Results.BadRequest(new { error = error.Message });
            }
        })
        .WithName("GenerateScheduleShifts")
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        var shifts = app.MapGroup("/api/shifts")
            .WithTags("Shifts")
            .RequireAuthorization();

        shifts.MapPost("/{shiftId:guid}/swap-requests", async (
            [FromRoute] Guid shiftId,
            [FromBody] CreateSwapRequest request,
            ClaimsPrincipal user,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var userId = GetCurrentUserId(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var swap = await scheduleRepository.CreateSwapRequestAsync(
                    shiftId,
                    userId.Value,
                    request.TargetUserId,
                    request.RequesterNote,
                    cancellationToken);

                return Results.Created($"/api/swap-requests/{swap.Id}", swap);
            }
            catch (Exception error) when (error is InvalidOperationException or KeyNotFoundException)
            {
                return Results.BadRequest(new { error = error.Message });
            }
        })
        .WithName("CreateShiftSwapRequest");

        var swaps = app.MapGroup("/api/swap-requests")
            .WithTags("Swap Requests")
            .RequireAuthorization();

        swaps.MapGet("/team/{teamId:guid}", async (
            [FromRoute] Guid teamId,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var requests = await scheduleRepository.GetSwapRequestsByTeamIdAsync(teamId, cancellationToken);
            return Results.Ok(requests);
        })
        .WithName("GetTeamSwapRequests")
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        swaps.MapPost("/{swapRequestId:guid}/approve", async (
            [FromRoute] Guid swapRequestId,
            [FromBody] DecideSwapRequest request,
            ClaimsPrincipal user,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var userId = GetCurrentUserId(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var swap = await scheduleRepository.ApproveSwapRequestAsync(
                    swapRequestId,
                    userId.Value,
                    request.DecisionNote,
                    cancellationToken);

                return Results.Ok(swap);
            }
            catch (Exception error) when (error is InvalidOperationException or KeyNotFoundException)
            {
                return Results.BadRequest(new { error = error.Message });
            }
        })
        .WithName("ApproveSwapRequest")
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        swaps.MapPost("/{swapRequestId:guid}/reject", async (
            [FromRoute] Guid swapRequestId,
            [FromBody] DecideSwapRequest request,
            ClaimsPrincipal user,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var userId = GetCurrentUserId(user);
            if (userId == null)
            {
                return Results.Unauthorized();
            }

            try
            {
                var swap = await scheduleRepository.RejectSwapRequestAsync(
                    swapRequestId,
                    userId.Value,
                    request.DecisionNote,
                    cancellationToken);

                return Results.Ok(swap);
            }
            catch (Exception error) when (error is InvalidOperationException or KeyNotFoundException)
            {
                return Results.BadRequest(new { error = error.Message });
            }
        })
        .WithName("RejectSwapRequest")
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));
    }

    private static Guid? GetCurrentUserId(ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}
