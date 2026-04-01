using Microsoft.AspNetCore.Mvc;
using alertblurty.Models.Interfaces;
using alertblurty.Models.Requests.Auth;

namespace alertblurty.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Authentication");

        group.MapPost("/register", async (
            [FromBody] RegisterRequest request,
            [FromServices] IAuthService authService,
            CancellationToken cancellationToken) =>
        {
            var result = await authService.RegisterAsync(request, cancellationToken);
            return result.Success
                ? Results.Ok(result)
                : Results.BadRequest(result);
        })
        .WithName("Register")
        .WithOpenApi()
        .Produces(200)
        .Produces(400);

        group.MapPost("/login", async (
            [FromBody] LoginRequest request,
            [FromServices] IAuthService authService,
            CancellationToken cancellationToken) =>
        {
            var result = await authService.LoginAsync(request, cancellationToken);
            return result.Success
                ? Results.Ok(result)
                : Results.Unauthorized();
        })
        .WithName("Login")
        .WithOpenApi()
        .Produces(200)
        .Produces(401);
    }
}
