using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using alertblurty.Data;
using alertblurty.Data.Entities;
using alertblurty.Data.Repositories;
using alertblurty.Data.Services;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;
using alertblurty.Models.Requests.Incidents;

namespace alertblurty.Tests;

public class IncidentServiceTests
{
    [Fact]
    public async Task ProcessZabbixWebhookAsync_FirstAlert_CreatesIncidentAndSendsNotification()
    {
        await using var context = CreateDbContext();
        var teamId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        await SeedTeamAsync(context, teamId);

        var scheduleRepository = new Mock<IScheduleRepository>();
        scheduleRepository
            .Setup(x => x.GetCurrentShiftAsync(teamId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OnCallShiftDto { UserId = userId });

        var userRepository = new Mock<IUserRepository>();
        userRepository
            .Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserDto
            {
                Id = userId,
                PhoneNumber = "+15555550123",
                FullName = "On Call",
                Email = "oncall@example.com"
            });

        var notificationService = new Mock<INotificationService>();
        notificationService
            .Setup(x => x.CreateNotificationAsync(
                It.IsAny<Guid>(),
                userId,
                "+15555550123",
                It.Is<string>(m => m.Contains("cpu-high")),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IncidentNotificationDto { Id = Guid.NewGuid(), Status = alertblurty.Models.DTOs.NotificationStatus.Sent });

        var service = CreateService(context, scheduleRepository.Object, userRepository.Object, notificationService.Object);

        var incident = await service.ProcessZabbixWebhookAsync(
            CreateProblemRequest(hostName: "web-01", triggerId: "cpu-high", eventId: "1001"),
            teamId);

        incident.TeamId.Should().Be(teamId);
        incident.EventCount.Should().Be(1);
        incident.Status.Should().Be(alertblurty.Models.DTOs.IncidentStatus.Open);
        notificationService.Verify(
            x => x.CreateNotificationAsync(
                incident.Id,
                userId,
                "+15555550123",
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ProcessZabbixWebhookAsync_DuplicateAlert_IncrementsCountWithoutSecondNotification()
    {
        await using var context = CreateDbContext();
        var teamId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        await SeedTeamAsync(context, teamId);

        var scheduleRepository = new Mock<IScheduleRepository>();
        scheduleRepository
            .Setup(x => x.GetCurrentShiftAsync(teamId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OnCallShiftDto { UserId = userId });

        var userRepository = new Mock<IUserRepository>();
        userRepository
            .Setup(x => x.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserDto
            {
                Id = userId,
                PhoneNumber = "+15555550123",
                FullName = "On Call",
                Email = "oncall@example.com"
            });

        var notificationService = new Mock<INotificationService>();
        notificationService
            .Setup(x => x.CreateNotificationAsync(
                It.IsAny<Guid>(),
                userId,
                "+15555550123",
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new IncidentNotificationDto { Id = Guid.NewGuid(), Status = alertblurty.Models.DTOs.NotificationStatus.Sent });

        var service = CreateService(context, scheduleRepository.Object, userRepository.Object, notificationService.Object);

        var first = await service.ProcessZabbixWebhookAsync(
            CreateProblemRequest(hostName: "db-01", triggerId: "disk-low", eventId: "2001"),
            teamId);

        var second = await service.ProcessZabbixWebhookAsync(
            CreateProblemRequest(hostName: "db-01", triggerId: "disk-low", eventId: "2002"),
            teamId);

        second.Id.Should().Be(first.Id);
        second.EventCount.Should().Be(2);
        notificationService.Verify(
            x => x.CreateNotificationAsync(
                It.IsAny<Guid>(),
                It.IsAny<Guid>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ProcessZabbixWebhookAsync_SameHostTriggerDifferentTeams_ShouldCreateSeparateIncidents()
    {
        await using var context = CreateDbContext();
        var teamA = Guid.NewGuid();
        var teamB = Guid.NewGuid();
        await SeedTeamAsync(context, teamA);
        await SeedTeamAsync(context, teamB);

        var scheduleRepository = new Mock<IScheduleRepository>();
        scheduleRepository
            .Setup(x => x.GetCurrentShiftAsync(It.IsAny<Guid>(), It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((OnCallShiftDto?)null);

        var userRepository = new Mock<IUserRepository>();
        var notificationService = new Mock<INotificationService>();
        var service = CreateService(context, scheduleRepository.Object, userRepository.Object, notificationService.Object);

        var request = CreateProblemRequest(hostName: "api-01", triggerId: "latency-high", eventId: "3001");
        var incidentForTeamA = await service.ProcessZabbixWebhookAsync(request, teamA);

        var incidentForTeamB = await service.ProcessZabbixWebhookAsync(
            CreateProblemRequest(hostName: "api-01", triggerId: "latency-high", eventId: "3002"),
            teamB);

        incidentForTeamA.TeamId.Should().Be(teamA);
        incidentForTeamB.TeamId.Should().Be(teamB, "grouping must be scoped per team");
    }

    [Fact]
    public async Task ProcessZabbixWebhookAsync_ResolvedWithoutOpenIncident_ShouldBeIdempotent()
    {
        await using var context = CreateDbContext();
        var teamId = Guid.NewGuid();
        await SeedTeamAsync(context, teamId);

        var scheduleRepository = new Mock<IScheduleRepository>();
        var userRepository = new Mock<IUserRepository>();
        var notificationService = new Mock<INotificationService>();
        var service = CreateService(context, scheduleRepository.Object, userRepository.Object, notificationService.Object);

        var action = async () =>
            await service.ProcessZabbixWebhookAsync(
                new ZabbixWebhookRequest
                {
                    EventId = "4001",
                    TriggerId = "memory-high",
                    TriggerName = "High memory usage",
                    TriggerDescription = "Memory above threshold",
                    HostName = "cache-01",
                    Severity = 3,
                    Status = "OK",
                    EventTime = DateTime.UtcNow
                },
                teamId);

        await action.Should().NotThrowAsync("resolve webhooks should be safe to replay even when no open incident exists");
    }

    private static IncidentService CreateService(
        AlertBlurtyDbContext context,
        IScheduleRepository scheduleRepository,
        IUserRepository userRepository,
        INotificationService notificationService)
    {
        var incidentRepository = new IncidentRepository(context);
        var logger = new Mock<ILogger<IncidentService>>().Object;
        return new IncidentService(incidentRepository, scheduleRepository, userRepository, notificationService, logger);
    }

    private static AlertBlurtyDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlertBlurtyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlertBlurtyDbContext(options);
    }

    private static ZabbixWebhookRequest CreateProblemRequest(string hostName, string triggerId, string eventId)
    {
        return new ZabbixWebhookRequest
        {
            EventId = eventId,
            TriggerId = triggerId,
            TriggerName = triggerId,
            TriggerDescription = "Synthetic test event",
            HostName = hostName,
            Severity = 4,
            Status = "PROBLEM",
            EventTime = DateTime.UtcNow
        };
    }

    private static async Task SeedTeamAsync(AlertBlurtyDbContext context, Guid teamId)
    {
        var organization = new Organization
        {
            Id = Guid.NewGuid(),
            Name = "QA Org",
            DefaultTimezone = "UTC",
            IsSetupComplete = true
        };

        var team = new Team
        {
            Id = teamId,
            OrganizationId = organization.Id,
            Name = $"Team-{teamId.ToString()[..8]}",
            Description = "QA seeded team"
        };

        context.Organizations.Add(organization);
        context.Teams.Add(team);
        await context.SaveChangesAsync();
    }
}
