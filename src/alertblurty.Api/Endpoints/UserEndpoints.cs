using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using alertblurty.Models.Interfaces;
using alertblurty.Models.Requests.Users;

namespace alertblurty.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users")
            .WithTags("Users")
            .RequireAuthorization();

        group.MapGet("/me", async (
            ClaimsPrincipal user,
            [FromServices] IUserRepository userRepository,
            CancellationToken cancellationToken) =>
        {
            var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Results.Unauthorized();
            }

            var userDto = await userRepository.GetByIdAsync(userId, cancellationToken);
            return userDto != null
                ? Results.Ok(userDto)
                : Results.NotFound();
        })
        .WithName("GetCurrentUser");

        group.MapGet("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromServices] IUserRepository userRepository,
            CancellationToken cancellationToken) =>
        {
            var userDto = await userRepository.GetByIdAsync(id, cancellationToken);
            return userDto != null
                ? Results.Ok(userDto)
                : Results.NotFound();
        })
        .WithName("GetUserById");

        group.MapGet("/organization/{organizationId:guid}", async (
            [FromRoute] Guid organizationId,
            [FromServices] IUserRepository userRepository,
            CancellationToken cancellationToken) =>
        {
            var users = await userRepository.GetByOrganizationIdAsync(organizationId, cancellationToken);
            return Results.Ok(users);
        })
        .WithName("GetUsersByOrganization");

        group.MapPost("/", async (
            [FromBody] CreateUserRequest request,
            ClaimsPrincipal user,
            [FromServices] IUserRepository userRepository,
            [FromServices] IPasswordHasher passwordHasher,
            CancellationToken cancellationToken) =>
        {
            // Get the current user's organization
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

            // Check if email already exists
            var existingUser = await userRepository.GetByEmailAsync(request.Email, cancellationToken);
            if (existingUser != null)
            {
                return Results.BadRequest(new { error = "User with this email already exists" });
            }

            var userDto = new Models.DTOs.UserDto
            {
                OrganizationId = request.OrganizationId,
                Email = request.Email,
                FullName = request.FullName,
                PhoneNumber = request.PhoneNumber,
                Timezone = request.Timezone,
                Role = request.Role,
                IsActive = request.IsActive
            };

            var passwordHash = passwordHasher.HashPassword(request.Password);
            var createdUser = await userRepository.CreateAsync(userDto, passwordHash, cancellationToken);

            return Results.Created($"/api/users/{createdUser.Id}", createdUser);
        })
        .WithName("CreateUser")
        .RequireAuthorization(policy => policy.RequireRole("Admin"));

        group.MapPut("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromBody] UpdateUserRequest request,
            [FromServices] IUserRepository userRepository,
            CancellationToken cancellationToken) =>
        {
            var userDto = await userRepository.GetByIdAsync(id, cancellationToken);
            if (userDto == null)
            {
                return Results.NotFound();
            }

            if (request.FullName != null) userDto.FullName = request.FullName;
            if (request.PhoneNumber != null) userDto.PhoneNumber = request.PhoneNumber;
            if (request.Timezone != null) userDto.Timezone = request.Timezone;
            if (request.Role.HasValue) userDto.Role = request.Role.Value;
            if (request.IsActive.HasValue) userDto.IsActive = request.IsActive.Value;

            var updatedUser = await userRepository.UpdateAsync(userDto, cancellationToken);
            return Results.Ok(updatedUser);
        })
        .WithName("UpdateUser")
        .RequireAuthorization(policy => policy.RequireRole("Admin"));

        group.MapDelete("/{id:guid}", async (
            [FromRoute] Guid id,
            [FromServices] IUserRepository userRepository,
            CancellationToken cancellationToken) =>
        {
            await userRepository.DeleteAsync(id, cancellationToken);
            return Results.NoContent();
        })
        .WithName("DeleteUser")
        .RequireAuthorization(policy => policy.RequireRole("Admin"));
    }
}
