using alertblurty.Data;
using alertblurty.Data.Entities;
using alertblurty.Data.Repositories;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using ModelFrequency = alertblurty.Models.DTOs.ScheduleFrequency;
using ModelSwapStatus = alertblurty.Models.DTOs.ShiftSwapRequestStatus;

namespace alertblurty.Tests;

public class ScheduleRepositoryTests
{
    [Fact]
    public async Task GenerateShiftsAsync_Assigns_members_by_rotation_order()
    {
        await using var context = CreateContext();
        var (_, _, users, schedule) = await SeedTeamScheduleAsync(context, requireApproval: false);
        var repository = new ScheduleRepository(context);

        var shifts = await repository.GenerateShiftsAsync(schedule.Id, 8, CancellationToken.None);

        shifts.Should().HaveCount(8);
        shifts.Select(shift => shift.UserFullName).Should().Equal(
            users[1].FullName,
            users[2].FullName,
            users[3].FullName,
            users[0].FullName,
            users[1].FullName,
            users[2].FullName,
            users[3].FullName,
            users[0].FullName);
    }

    [Fact]
    public async Task CreateSwapRequestAsync_Applies_immediately_when_team_does_not_require_approval()
    {
        await using var context = CreateContext();
        var (_, _, users, schedule) = await SeedTeamScheduleAsync(context, requireApproval: false);
        var repository = new ScheduleRepository(context);
        var shifts = await repository.GenerateShiftsAsync(schedule.Id, 1, CancellationToken.None);
        var shift = shifts.Single();

        var swap = await repository.CreateSwapRequestAsync(
            shift.Id,
            shift.UserId,
            users[2].Id,
            "Can you take this?",
            CancellationToken.None);

        swap.Status.Should().Be(ModelSwapStatus.Applied);
        swap.RequiresApprovalSnapshot.Should().BeFalse();
        swap.RequesterNote.Should().Be("Can you take this?");
        var updatedShift = await context.OnCallShifts.SingleAsync(entity => entity.Id == shift.Id);
        updatedShift.UserId.Should().Be(users[2].Id);
        updatedShift.IsSwapped.Should().BeTrue();
        updatedShift.SwappedWithUserId.Should().Be(shift.UserId);
        updatedShift.ApprovedByUserId.Should().BeNull();
    }

    [Fact]
    public async Task CreateSwapRequestAsync_Creates_pending_request_when_team_requires_approval()
    {
        await using var context = CreateContext();
        var (_, _, users, schedule) = await SeedTeamScheduleAsync(context, requireApproval: true);
        var repository = new ScheduleRepository(context);
        var shifts = await repository.GenerateShiftsAsync(schedule.Id, 1, CancellationToken.None);
        var shift = shifts.Single();

        var swap = await repository.CreateSwapRequestAsync(
            shift.Id,
            shift.UserId,
            users[2].Id,
            "",
            CancellationToken.None);

        swap.Status.Should().Be(ModelSwapStatus.Pending);
        swap.RequiresApprovalSnapshot.Should().BeTrue();
        var updatedShift = await repository.GetShiftsByScheduleIdAsync(schedule.Id, CancellationToken.None);
        updatedShift.Single().UserId.Should().Be(shift.UserId);
        updatedShift.Single().HasPendingSwapRequest.Should().BeTrue();
        updatedShift.Single().PendingSwapTargetUserId.Should().Be(users[2].Id);
    }

    [Fact]
    public async Task ApproveSwapRequestAsync_Applies_pending_request()
    {
        await using var context = CreateContext();
        var (_, _, users, schedule) = await SeedTeamScheduleAsync(context, requireApproval: true);
        var repository = new ScheduleRepository(context);
        var shift = (await repository.GenerateShiftsAsync(schedule.Id, 1, CancellationToken.None)).Single();
        var swap = await repository.CreateSwapRequestAsync(shift.Id, shift.UserId, users[2].Id, "", CancellationToken.None);

        var approved = await repository.ApproveSwapRequestAsync(swap.Id, users[3].Id, "Approved", CancellationToken.None);

        approved.Status.Should().Be(ModelSwapStatus.Approved);
        approved.DecidedByUserId.Should().Be(users[3].Id);
        approved.DecisionNote.Should().Be("Approved");
        var updatedShift = await context.OnCallShifts.SingleAsync(entity => entity.Id == shift.Id);
        updatedShift.UserId.Should().Be(users[2].Id);
        updatedShift.IsSwapped.Should().BeTrue();
        updatedShift.SwappedWithUserId.Should().Be(shift.UserId);
        updatedShift.ApprovedByUserId.Should().Be(users[3].Id);
    }

    [Fact]
    public async Task RejectSwapRequestAsync_Leaves_shift_assignee_unchanged()
    {
        await using var context = CreateContext();
        var (_, _, users, schedule) = await SeedTeamScheduleAsync(context, requireApproval: true);
        var repository = new ScheduleRepository(context);
        var shift = (await repository.GenerateShiftsAsync(schedule.Id, 1, CancellationToken.None)).Single();
        var swap = await repository.CreateSwapRequestAsync(shift.Id, shift.UserId, users[2].Id, "", CancellationToken.None);

        var rejected = await repository.RejectSwapRequestAsync(swap.Id, users[3].Id, "Not this time", CancellationToken.None);

        rejected.Status.Should().Be(ModelSwapStatus.Rejected);
        rejected.DecidedByUserId.Should().Be(users[3].Id);
        rejected.DecisionNote.Should().Be("Not this time");
        var updatedShift = await context.OnCallShifts.SingleAsync(entity => entity.Id == shift.Id);
        updatedShift.UserId.Should().Be(shift.UserId);
        updatedShift.IsSwapped.Should().BeFalse();
        updatedShift.SwappedWithUserId.Should().BeNull();
        updatedShift.ApprovedByUserId.Should().BeNull();
    }

    private static AlertBlurtyDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AlertBlurtyDbContext>()
            .UseInMemoryDatabase($"schedule-repository-tests-{Guid.NewGuid():N}")
            .Options;

        return new AlertBlurtyDbContext(options);
    }

    private static async Task<(Organization Organization, Team Team, List<User> Users, OnCallSchedule Schedule)> SeedTeamScheduleAsync(
        AlertBlurtyDbContext context,
        bool requireApproval)
    {
        var organization = new Organization
        {
            Id = Guid.NewGuid(),
            Name = $"Org {Guid.NewGuid():N}",
            DefaultTimezone = "UTC",
            IsSetupComplete = true
        };
        var team = new Team
        {
            Id = Guid.NewGuid(),
            OrganizationId = organization.Id,
            Name = requireApproval ? "Approval Team" : "Auto Team",
            Description = "On-call",
            RequireAdminApprovalForSwaps = requireApproval
        };
        var users = Enumerable.Range(1, 4)
            .Select(index => new User
            {
                Id = Guid.NewGuid(),
                OrganizationId = organization.Id,
                Email = $"user{index}-{Guid.NewGuid():N}@example.com",
                FullName = $"User {index}",
                PasswordHash = "hash",
                PhoneNumber = $"+1555555012{index}",
                Timezone = "UTC",
                Role = Data.Entities.UserRole.User,
                IsActive = true
            })
            .ToList();
        var schedule = new OnCallSchedule
        {
            Id = Guid.NewGuid(),
            TeamId = team.Id,
            Name = "Primary",
            Frequency = Data.Entities.ScheduleFrequency.Daily,
            StartTimeUtc = new DateTime(2026, 6, 11, 0, 0, 0, DateTimeKind.Utc),
            DurationMinutes = 1440,
            IsActive = true
        };

        context.Organizations.Add(organization);
        context.Teams.Add(team);
        context.Users.AddRange(users);
        context.TeamMembers.AddRange(
            new TeamMember { Id = Guid.NewGuid(), TeamId = team.Id, UserId = users[1].Id, RotationOrder = 1, IsActive = true },
            new TeamMember { Id = Guid.NewGuid(), TeamId = team.Id, UserId = users[2].Id, RotationOrder = 2, IsActive = true },
            new TeamMember { Id = Guid.NewGuid(), TeamId = team.Id, UserId = users[3].Id, RotationOrder = 3, IsActive = true },
            new TeamMember { Id = Guid.NewGuid(), TeamId = team.Id, UserId = users[0].Id, RotationOrder = 4, IsActive = true });
        context.OnCallSchedules.Add(schedule);
        await context.SaveChangesAsync();

        return (organization, team, users, schedule);
    }
}
