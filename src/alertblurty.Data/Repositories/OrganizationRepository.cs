using Microsoft.EntityFrameworkCore;
using alertblurty.Data.Entities;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;

namespace alertblurty.Data.Repositories;

public class OrganizationRepository : IOrganizationRepository
{
    private readonly AlertBlurtyDbContext _context;

    public OrganizationRepository(AlertBlurtyDbContext context)
    {
        _context = context;
    }

    public async Task<OrganizationDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations.FindAsync(new object[] { id }, cancellationToken);
        return org == null ? null : MapToDto(org);
    }

    public async Task<OrganizationDto> CreateAsync(OrganizationDto organizationDto, CancellationToken cancellationToken = default)
    {
        var org = new Organization
        {
            Id = Guid.NewGuid(),
            Name = organizationDto.Name,
            DefaultTimezone = organizationDto.DefaultTimezone,
            IsSetupComplete = false
        };

        _context.Organizations.Add(org);
        await _context.SaveChangesAsync(cancellationToken);

        return MapToDto(org);
    }

    public async Task<OrganizationDto> UpdateAsync(OrganizationDto organizationDto, CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations.FindAsync(new object[] { organizationDto.Id }, cancellationToken)
            ?? throw new KeyNotFoundException($"Organization with ID {organizationDto.Id} not found");

        org.Name = organizationDto.Name;
        org.DefaultTimezone = organizationDto.DefaultTimezone;

        await _context.SaveChangesAsync(cancellationToken);

        return MapToDto(org);
    }

    public async Task CompleteSetupAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var org = await _context.Organizations.FindAsync(new object[] { id }, cancellationToken)
            ?? throw new KeyNotFoundException($"Organization with ID {id} not found");

        org.IsSetupComplete = true;
        await _context.SaveChangesAsync(cancellationToken);
    }

    private static OrganizationDto MapToDto(Organization org)
    {
        return new OrganizationDto
        {
            Id = org.Id,
            Name = org.Name,
            DefaultTimezone = org.DefaultTimezone,
            IsSetupComplete = org.IsSetupComplete,
            CreatedAtUtc = org.CreatedAtUtc,
            UpdatedAtUtc = org.UpdatedAtUtc
        };
    }
}
