using Microsoft.EntityFrameworkCore;
using alertblurty.Data.Entities;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;

namespace alertblurty.Data.Repositories;

public class UserRepository : IUserRepository
{
    private readonly AlertBlurtyDbContext _context;

    public UserRepository(AlertBlurtyDbContext context)
    {
        _context = context;
    }

    public async Task<UserDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        return user == null ? null : MapToDto(user);
    }

    public async Task<UserDto?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        return user == null ? null : MapToDto(user);
    }

    public async Task<List<UserDto>> GetByOrganizationIdAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        var users = await _context.Users
            .Include(u => u.Organization)
            .Where(u => u.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);

        return users.Select(MapToDto).ToList();
    }

    public async Task<UserDto> CreateAsync(UserDto userDto, string passwordHash, CancellationToken cancellationToken = default)
    {
        var user = new User
        {
            Id = Guid.NewGuid(),
            OrganizationId = userDto.OrganizationId,
            Email = userDto.Email,
            PasswordHash = passwordHash,
            FullName = userDto.FullName,
            PhoneNumber = userDto.PhoneNumber,
            Timezone = userDto.Timezone,
            Role = (Data.Entities.UserRole)userDto.Role,
            IsActive = userDto.IsActive
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(user.Id, cancellationToken) ?? throw new InvalidOperationException("Failed to retrieve created user");
    }

    public async Task<UserDto> UpdateAsync(UserDto userDto, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FindAsync(new object[] { userDto.Id }, cancellationToken)
            ?? throw new KeyNotFoundException($"User with ID {userDto.Id} not found");

        user.FullName = userDto.FullName;
        user.PhoneNumber = userDto.PhoneNumber;
        user.Timezone = userDto.Timezone;
        user.Role = (Data.Entities.UserRole)userDto.Role;
        user.IsActive = userDto.IsActive;

        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(user.Id, cancellationToken) ?? throw new InvalidOperationException("Failed to retrieve updated user");
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FindAsync(new object[] { id }, cancellationToken)
            ?? throw new KeyNotFoundException($"User with ID {id} not found");

        _context.Users.Remove(user);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<string?> GetPasswordHashAsync(string email, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        return user?.PasswordHash;
    }

    private static UserDto MapToDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            OrganizationId = user.OrganizationId,
            Email = user.Email,
            FullName = user.FullName,
            PhoneNumber = user.PhoneNumber,
            Timezone = user.Timezone,
            Role = (Models.DTOs.UserRole)user.Role,
            IsActive = user.IsActive,
            CreatedAtUtc = user.CreatedAtUtc,
            UpdatedAtUtc = user.UpdatedAtUtc,
            OrganizationName = user.Organization?.Name
        };
    }
}
