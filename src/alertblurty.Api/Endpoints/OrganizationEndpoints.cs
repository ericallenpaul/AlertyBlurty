using Microsoft.AspNetCore.Mvc;
using alertblurty.Models.Interfaces;

namespace alertblurty.Api.Endpoints;

public static class OrganizationEndpoints
{
    public static void MapOrganizationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/organizations")
            .WithTags("Organizations");

        group.MapGet("/", async (
            [FromServices] IOrganizationRepository organizationRepository,
            CancellationToken cancellationToken) =>
        {
            var organizations = await organizationRepository.GetAllAsync(cancellationToken);
            return Results.Ok(organizations);
        })
        .WithName("GetOrganizations")
        .Produces(200);
    }
}
