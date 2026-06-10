# Team Schedule Swap E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a calendar-first team scheduling MVP with rotation generation, shift swaps, admin approval mode, E2E tests, and a usability evaluation.

**Architecture:** Add schedule/swap behavior to the existing Minimal API, repository, and React page structure. Keep schedule generation and swap rules in focused data/repository methods, expose them through explicit endpoints, then add a FullCalendar-based team schedule panel inside `TeamDetailsPage`.

**Tech Stack:** ASP.NET Core Minimal APIs, EF Core/Npgsql, xUnit, React 19, Bootstrap 5, FullCalendar React, Vitest, Playwright.

---

## File Structure

Backend model and persistence:

- Create: `src/alertblurty.Data/Entities/ShiftSwapRequest.cs`
- Modify: `src/alertblurty.Data/Entities/OnCallShift.cs`
- Modify: `src/alertblurty.Data/AlertBlurtyDbContext.cs`
- Modify: `src/alertblurty.Data/Repositories/ScheduleRepository.cs`
- Modify: `src/alertblurty.Models/Interfaces/IScheduleRepository.cs`
- Create: EF migration under `src/alertblurty.Data/Migrations/`

Backend DTOs and requests:

- Modify: `src/alertblurty.Models/DTOs/OnCallShiftDto.cs`
- Create: `src/alertblurty.Models/DTOs/ShiftSwapRequestDto.cs`
- Create: `src/alertblurty.Models/Requests/Schedules/GenerateShiftsRequest.cs`
- Create: `src/alertblurty.Models/Requests/Schedules/CreateSwapRequest.cs`
- Create: `src/alertblurty.Models/Requests/Schedules/DecideSwapRequest.cs`

Backend endpoints:

- Create: `src/alertblurty.Api/Endpoints/ScheduleEndpoints.cs`
- Modify: `src/alertblurty.Api/Program.cs`

Backend tests:

- Create: `tests/alertblurty.Tests/ScheduleRepositoryTests.cs`
- Create: `tests/alertblurty.Tests/ScheduleEndpointTests.cs`

Frontend API and types:

- Modify: `src/alertblurty.Web/package.json`
- Modify: `src/alertblurty.Web/package-lock.json`
- Modify: `src/alertblurty.Web/src/types/api.ts`
- Create: `src/alertblurty.Web/src/api/schedules.ts`

Frontend UI:

- Create: `src/alertblurty.Web/src/components/team-schedule/TeamSchedulePanel.tsx`
- Create: `src/alertblurty.Web/src/components/team-schedule/ScheduleFormModal.tsx`
- Create: `src/alertblurty.Web/src/components/team-schedule/ShiftDetailsModal.tsx`
- Create: `src/alertblurty.Web/src/components/team-schedule/PendingSwapRequests.tsx`
- Modify: `src/alertblurty.Web/src/pages/TeamDetailsPage.tsx`
- Modify: `src/alertblurty.Web/src/styles/alertyblurty.css`

Frontend tests and evaluation:

- Create: `src/alertblurty.Web/src/components/team-schedule/TeamSchedulePanel.test.tsx`
- Create: `src/alertblurty.Web/tests/e2e/team-schedule-swap.spec.ts`
- Create: `docs/evaluations/team-schedule-swap-usability.md`

## Task 1: Backend Swap Model and DTOs

**Files:**
- Create: `src/alertblurty.Data/Entities/ShiftSwapRequest.cs`
- Modify: `src/alertblurty.Data/Entities/OnCallShift.cs`
- Modify: `src/alertblurty.Data/AlertBlurtyDbContext.cs`
- Create: `src/alertblurty.Models/DTOs/ShiftSwapRequestDto.cs`
- Modify: `src/alertblurty.Models/DTOs/OnCallShiftDto.cs`

- [ ] **Step 1: Add the swap request entity**

Create `src/alertblurty.Data/Entities/ShiftSwapRequest.cs`:

```csharp
namespace alertblurty.Data.Entities;

public class ShiftSwapRequest : BaseEntity
{
    public Guid ShiftId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public Guid TargetUserId { get; set; }
    public ShiftSwapRequestStatus Status { get; set; } = ShiftSwapRequestStatus.Pending;
    public bool RequiresApprovalSnapshot { get; set; }
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public string RequesterNote { get; set; } = string.Empty;
    public string DecisionNote { get; set; } = string.Empty;

    public OnCallShift Shift { get; set; } = null!;
    public User RequestedByUser { get; set; } = null!;
    public User TargetUser { get; set; } = null!;
    public User? DecidedByUser { get; set; }
}

public enum ShiftSwapRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Applied = 3
}
```

- [ ] **Step 2: Link shifts to swap requests**

Add this property to `OnCallShift` before the closing brace:

```csharp
public ICollection<ShiftSwapRequest> SwapRequests { get; set; } = new List<ShiftSwapRequest>();
```

- [ ] **Step 3: Register the DbSet**

Add this property to `AlertBlurtyDbContext` with the other `DbSet` properties:

```csharp
public DbSet<ShiftSwapRequest> ShiftSwapRequests { get; set; }
```

- [ ] **Step 4: Add the API DTO**

Create `src/alertblurty.Models/DTOs/ShiftSwapRequestDto.cs`:

```csharp
namespace alertblurty.Models.DTOs;

public class ShiftSwapRequestDto : BaseDto
{
    public Guid ShiftId { get; set; }
    public Guid ScheduleId { get; set; }
    public Guid TeamId { get; set; }
    public Guid RequestedByUserId { get; set; }
    public Guid TargetUserId { get; set; }
    public ShiftSwapRequestStatus Status { get; set; }
    public bool RequiresApprovalSnapshot { get; set; }
    public DateTime RequestedAtUtc { get; set; }
    public DateTime? DecidedAtUtc { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public string RequesterNote { get; set; } = string.Empty;
    public string DecisionNote { get; set; } = string.Empty;
    public string? RequestedByUserFullName { get; set; }
    public string? TargetUserFullName { get; set; }
    public string? DecidedByUserFullName { get; set; }
    public DateTime ShiftStartTimeUtc { get; set; }
    public DateTime ShiftEndTimeUtc { get; set; }
}

public enum ShiftSwapRequestStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2,
    Applied = 3
}
```

- [ ] **Step 5: Add pending swap fields to shift DTO**

Add these properties to `OnCallShiftDto`:

```csharp
public bool HasPendingSwapRequest { get; set; }
public Guid? PendingSwapRequestId { get; set; }
public Guid? PendingSwapTargetUserId { get; set; }
public string? PendingSwapTargetUserFullName { get; set; }
```

- [ ] **Step 6: Run model build**

Run:

```powershell
dotnet build alertblurty.sln
```

Expected: build fails until repository mapping and EF relationships are added in the next task, or passes if EF conventions are enough. Continue to Task 2 either way.

## Task 2: Schedule Repository Rules and Tests

**Files:**
- Modify: `src/alertblurty.Models/Interfaces/IScheduleRepository.cs`
- Modify: `src/alertblurty.Data/Repositories/ScheduleRepository.cs`
- Create: `tests/alertblurty.Tests/ScheduleRepositoryTests.cs`

- [ ] **Step 1: Write repository tests for generation and immediate swaps**

Create `tests/alertblurty.Tests/ScheduleRepositoryTests.cs` with these test names and helper shape:

```csharp
using alertblurty.Data;
using alertblurty.Data.Entities;
using alertblurty.Data.Repositories;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using ModelScheduleFrequency = alertblurty.Models.DTOs.ScheduleFrequency;
using ModelSwapStatus = alertblurty.Models.DTOs.ShiftSwapRequestStatus;

namespace alertblurty.Tests;

public class ScheduleRepositoryTests
{
    [Fact]
    public async Task GenerateShiftsAsync_Assigns_members_by_rotation_order()
    {
        await using var context = CreateContext();
        var (_, team, users, schedule) = await SeedTeamScheduleAsync(context, requireApproval: false);
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
        shifts.Select(shift => shift.StartTimeUtc).Should().OnlyHaveUniqueItems();
        team.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GenerateShiftsAsync_Does_not_duplicate_existing_shift_start_times()
    {
        await using var context = CreateContext();
        var (_, _, _, schedule) = await SeedTeamScheduleAsync(context, requireApproval: false);
        var repository = new ScheduleRepository(context);

        await repository.GenerateShiftsAsync(schedule.Id, 4, CancellationToken.None);
        var shifts = await repository.GenerateShiftsAsync(schedule.Id, 4, CancellationToken.None);

        shifts.Should().HaveCount(4);
        context.OnCallShifts.Should().HaveCount(4);
    }

    [Fact]
    public async Task CreateSwapRequestAsync_Applies_immediately_when_team_does_not_require_approval()
    {
        await using var context = CreateContext();
        var (_, _, users, schedule) = await SeedTeamScheduleAsync(context, requireApproval: false);
        var repository = new ScheduleRepository(context);
        var shift = (await repository.GenerateShiftsAsync(schedule.Id, 1, CancellationToken.None)).Single();

        var swap = await repository.CreateSwapRequestAsync(
            shift.Id,
            shift.UserId,
            users[2].Id,
            "Trade please",
            CancellationToken.None);

        swap.Status.Should().Be(ModelSwapStatus.Applied);
        var updatedShift = (await repository.GetShiftsByScheduleIdAsync(schedule.Id, CancellationToken.None)).Single();
        updatedShift.UserId.Should().Be(users[2].Id);
        updatedShift.IsSwapped.Should().BeTrue();
        updatedShift.SwappedWithUserId.Should().Be(shift.UserId);
    }

    [Fact]
    public async Task CreateSwapRequestAsync_Creates_pending_request_when_team_requires_approval()
    {
        await using var context = CreateContext();
        var (_, _, users, schedule) = await SeedTeamScheduleAsync(context, requireApproval: true);
        var repository = new ScheduleRepository(context);
        var shift = (await repository.GenerateShiftsAsync(schedule.Id, 1, CancellationToken.None)).Single();

        var swap = await repository.CreateSwapRequestAsync(
            shift.Id,
            shift.UserId,
            users[2].Id,
            "Trade please",
            CancellationToken.None);

        swap.Status.Should().Be(ModelSwapStatus.Pending);
        var updatedShift = (await repository.GetShiftsByScheduleIdAsync(schedule.Id, CancellationToken.None)).Single();
        updatedShift.UserId.Should().Be(shift.UserId);
        updatedShift.HasPendingSwapRequest.Should().BeTrue();
        updatedShift.PendingSwapTargetUserId.Should().Be(users[2].Id);
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
        var updatedShift = (await repository.GetShiftsByScheduleIdAsync(schedule.Id, CancellationToken.None)).Single();
        updatedShift.UserId.Should().Be(users[2].Id);
        updatedShift.ApprovedByUserId.Should().Be(users[3].Id);
    }

    [Fact]
    public async Task RejectSwapRequestAsync_Leaves_shift_unchanged()
    {
        await using var context = CreateContext();
        var (_, _, users, schedule) = await SeedTeamScheduleAsync(context, requireApproval: true);
        var repository = new ScheduleRepository(context);
        var shift = (await repository.GenerateShiftsAsync(schedule.Id, 1, CancellationToken.None)).Single();
        var swap = await repository.CreateSwapRequestAsync(shift.Id, shift.UserId, users[2].Id, "", CancellationToken.None);

        var rejected = await repository.RejectSwapRequestAsync(swap.Id, users[3].Id, "No", CancellationToken.None);

        rejected.Status.Should().Be(ModelSwapStatus.Rejected);
        var updatedShift = (await repository.GetShiftsByScheduleIdAsync(schedule.Id, CancellationToken.None)).Single();
        updatedShift.UserId.Should().Be(shift.UserId);
        updatedShift.HasPendingSwapRequest.Should().BeFalse();
    }

    private static AlertBlurtyDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AlertBlurtyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AlertBlurtyDbContext(options);
    }

    private static async Task<(Organization Organization, Team Team, List<User> Users, OnCallSchedule Schedule)> SeedTeamScheduleAsync(
        AlertBlurtyDbContext context,
        bool requireApproval)
    {
        var organization = new Organization { Id = Guid.NewGuid(), Name = "Ops", DefaultTimezone = "UTC", IsSetupComplete = true };
        var team = new Team { Id = Guid.NewGuid(), OrganizationId = organization.Id, Name = "Primary", Description = "Primary on-call", RequireAdminApprovalForSwaps = requireApproval };
        var users = Enumerable.Range(1, 4)
            .Select(index => new User
            {
                Id = Guid.NewGuid(),
                OrganizationId = organization.Id,
                Email = $"user{index}@example.com",
                FullName = $"User {index}",
                PhoneNumber = $"+1555555012{index}",
                Timezone = "UTC",
                Role = UserRole.User,
                PasswordHash = "hash",
                IsActive = true
            })
            .ToList();

        context.Organizations.Add(organization);
        context.Teams.Add(team);
        context.Users.AddRange(users);
        context.TeamMembers.AddRange(
            new TeamMember { Id = Guid.NewGuid(), TeamId = team.Id, UserId = users[1].Id, RotationOrder = 1, IsActive = true },
            new TeamMember { Id = Guid.NewGuid(), TeamId = team.Id, UserId = users[2].Id, RotationOrder = 2, IsActive = true },
            new TeamMember { Id = Guid.NewGuid(), TeamId = team.Id, UserId = users[3].Id, RotationOrder = 3, IsActive = true },
            new TeamMember { Id = Guid.NewGuid(), TeamId = team.Id, UserId = users[0].Id, RotationOrder = 4, IsActive = true });

        var schedule = new OnCallSchedule
        {
            Id = Guid.NewGuid(),
            TeamId = team.Id,
            Name = "Daily Primary",
            Frequency = alertblurty.Data.Entities.ScheduleFrequency.Daily,
            StartTimeUtc = new DateTime(2026, 6, 10, 9, 0, 0, DateTimeKind.Utc),
            DurationMinutes = 1440,
            IsActive = true
        };

        context.OnCallSchedules.Add(schedule);
        await context.SaveChangesAsync();
        return (organization, team, users, schedule);
    }
}
```

- [ ] **Step 2: Run failing repository tests**

Run:

```powershell
dotnet test tests\alertblurty.Tests\alertblurty.Tests.csproj --filter ScheduleRepositoryTests
```

Expected: fails because repository methods are not defined.

- [ ] **Step 3: Extend repository interface**

Add these methods to `IScheduleRepository`:

```csharp
Task<List<OnCallShiftDto>> GenerateShiftsAsync(Guid scheduleId, int shiftCount, CancellationToken cancellationToken = default);
Task<ShiftSwapRequestDto> CreateSwapRequestAsync(Guid shiftId, Guid requestedByUserId, Guid targetUserId, string requesterNote, CancellationToken cancellationToken = default);
Task<List<ShiftSwapRequestDto>> GetSwapRequestsByTeamIdAsync(Guid teamId, CancellationToken cancellationToken = default);
Task<ShiftSwapRequestDto> ApproveSwapRequestAsync(Guid swapRequestId, Guid decidedByUserId, string decisionNote, CancellationToken cancellationToken = default);
Task<ShiftSwapRequestDto> RejectSwapRequestAsync(Guid swapRequestId, Guid decidedByUserId, string decisionNote, CancellationToken cancellationToken = default);
```

- [ ] **Step 4: Implement generation in `ScheduleRepository`**

Add a public method with this signature and behavior:

```csharp
public async Task<List<OnCallShiftDto>> GenerateShiftsAsync(Guid scheduleId, int shiftCount, CancellationToken cancellationToken = default)
```

Implementation rules:

- Load schedule with team members ordered by `RotationOrder`.
- Reject missing schedules with `KeyNotFoundException`.
- Reject teams with no active members using `InvalidOperationException("Team has no active members.")`.
- Use existing shift count for that schedule as the rotation offset.
- Create shift starts by adding the schedule frequency from `StartTimeUtc`.
- Skip already existing `(ScheduleId, StartTimeUtc)` shifts.
- Save once and return `GetShiftsByScheduleIdAsync(scheduleId, cancellationToken)`.

Use this helper in the same class:

```csharp
private static DateTime AddFrequency(DateTime start, Models.DTOs.ScheduleFrequency frequency, int periods)
{
    return frequency switch
    {
        Models.DTOs.ScheduleFrequency.Hourly => start.AddHours(periods),
        Models.DTOs.ScheduleFrequency.Daily => start.AddDays(periods),
        Models.DTOs.ScheduleFrequency.Weekly => start.AddDays(7 * periods),
        Models.DTOs.ScheduleFrequency.Monthly => start.AddMonths(periods),
        _ => throw new ArgumentOutOfRangeException(nameof(frequency), frequency, "Unsupported schedule frequency.")
    };
}
```

- [ ] **Step 5: Implement swap request methods**

Add `CreateSwapRequestAsync`, `GetSwapRequestsByTeamIdAsync`, `ApproveSwapRequestAsync`, and `RejectSwapRequestAsync` to `ScheduleRepository`.

Required behavior:

- Load shift with schedule, team, and team members.
- `requestedByUserId` must match current `shift.UserId`.
- `targetUserId` must be an active member of the same team.
- A shift with an existing pending request rejects a new request using `InvalidOperationException("Shift already has a pending swap request.")`.
- If `RequireAdminApprovalForSwaps` is false, update `shift.UserId` to the target user, set `IsSwapped = true`, set `SwappedWithUserId` to the previous user, and store swap status `Applied`.
- If `RequireAdminApprovalForSwaps` is true, store swap status `Pending` and do not change the shift assignee.
- Approval applies the pending request and sets `ApprovedByUserId`.
- Rejection changes only the request status and decision fields.

- [ ] **Step 6: Update shift mapping with pending swap fields**

In `MapShiftToDto`, populate:

```csharp
var pendingSwap = shift.SwapRequests?
    .FirstOrDefault(request => request.Status == Data.Entities.ShiftSwapRequestStatus.Pending);
```

Then assign:

```csharp
HasPendingSwapRequest = pendingSwap != null,
PendingSwapRequestId = pendingSwap?.Id,
PendingSwapTargetUserId = pendingSwap?.TargetUserId,
PendingSwapTargetUserFullName = pendingSwap?.TargetUser?.FullName
```

Ensure `GetShiftsByScheduleIdAsync` includes:

```csharp
.Include(s => s.SwapRequests)
    .ThenInclude(r => r.TargetUser)
```

- [ ] **Step 7: Run repository tests**

Run:

```powershell
dotnet test tests\alertblurty.Tests\alertblurty.Tests.csproj --filter ScheduleRepositoryTests
```

Expected: all `ScheduleRepositoryTests` pass.

- [ ] **Step 8: Commit backend repository behavior**

Run:

```powershell
git add src\alertblurty.Data src\alertblurty.Models tests\alertblurty.Tests\ScheduleRepositoryTests.cs
git commit -m "feat: add schedule generation and swap rules"
```

## Task 3: EF Migration and Schedule Endpoints

**Files:**
- Create: `src/alertblurty.Models/Requests/Schedules/GenerateShiftsRequest.cs`
- Create: `src/alertblurty.Models/Requests/Schedules/CreateSwapRequest.cs`
- Create: `src/alertblurty.Models/Requests/Schedules/DecideSwapRequest.cs`
- Create: `src/alertblurty.Api/Endpoints/ScheduleEndpoints.cs`
- Modify: `src/alertblurty.Api/Program.cs`
- Create: `tests/alertblurty.Tests/ScheduleEndpointTests.cs`
- Create: EF migration under `src/alertblurty.Data/Migrations/`

- [ ] **Step 1: Add request models**

Create `GenerateShiftsRequest.cs`:

```csharp
namespace alertblurty.Models.Requests.Schedules;

public class GenerateShiftsRequest
{
    public int ShiftCount { get; set; } = 14;
}
```

Create `CreateSwapRequest.cs`:

```csharp
namespace alertblurty.Models.Requests.Schedules;

public class CreateSwapRequest
{
    public Guid TargetUserId { get; set; }
    public string RequesterNote { get; set; } = string.Empty;
}
```

Create `DecideSwapRequest.cs`:

```csharp
namespace alertblurty.Models.Requests.Schedules;

public class DecideSwapRequest
{
    public string DecisionNote { get; set; } = string.Empty;
}
```

- [ ] **Step 2: Write endpoint tests**

Create `tests/alertblurty.Tests/ScheduleEndpointTests.cs` with tests named:

```csharp
[Fact]
public async Task Create_schedule_then_generate_shifts_returns_rotation()

[Fact]
public async Task No_approval_swap_endpoint_applies_immediately()

[Fact]
public async Task Approval_swap_endpoint_requires_admin_decision()
```

Use `WebApplicationFactory<Program>` like `OrganizationEndpointTests.cs`. Seed or register users through the API, log in, then call the schedule endpoints with bearer tokens. Assert status codes and response JSON fields.

- [ ] **Step 3: Run failing endpoint tests**

Run:

```powershell
dotnet test tests\alertblurty.Tests\alertblurty.Tests.csproj --filter ScheduleEndpointTests
```

Expected: fails because endpoints are not mapped.

- [ ] **Step 4: Create schedule endpoints**

Create `src/alertblurty.Api/Endpoints/ScheduleEndpoints.cs`:

```csharp
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
        var teamGroup = app.MapGroup("/api/teams")
            .WithTags("Schedules")
            .RequireAuthorization();

        teamGroup.MapGet("/{teamId:guid}/schedules", async (
            [FromRoute] Guid teamId,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var schedules = await scheduleRepository.GetByTeamIdAsync(teamId, cancellationToken);
            return Results.Ok(schedules);
        }).WithName("GetTeamSchedules");

        teamGroup.MapPost("/{teamId:guid}/schedules", async (
            [FromRoute] Guid teamId,
            [FromBody] CreateScheduleRequest request,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var schedule = await scheduleRepository.CreateAsync(new OnCallScheduleDto
            {
                TeamId = teamId,
                Name = request.Name,
                Frequency = request.Frequency,
                StartTimeUtc = request.StartTimeUtc,
                DurationMinutes = request.DurationMinutes,
                IsActive = true
            }, cancellationToken);

            return Results.Created($"/api/schedules/{schedule.Id}", schedule);
        })
        .WithName("CreateTeamSchedule")
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        teamGroup.MapGet("/{teamId:guid}/swap-requests", async (
            [FromRoute] Guid teamId,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var requests = await scheduleRepository.GetSwapRequestsByTeamIdAsync(teamId, cancellationToken);
            return Results.Ok(requests);
        })
        .WithName("GetTeamSwapRequests")
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        var scheduleGroup = app.MapGroup("/api/schedules")
            .WithTags("Schedules")
            .RequireAuthorization();

        scheduleGroup.MapGet("/{scheduleId:guid}/shifts", async (
            [FromRoute] Guid scheduleId,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var shifts = await scheduleRepository.GetShiftsByScheduleIdAsync(scheduleId, cancellationToken);
            return Results.Ok(shifts);
        }).WithName("GetScheduleShifts");

        scheduleGroup.MapPost("/{scheduleId:guid}/generate-shifts", async (
            [FromRoute] Guid scheduleId,
            [FromBody] GenerateShiftsRequest request,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            if (request.ShiftCount is < 1 or > 90)
            {
                return Results.BadRequest("ShiftCount must be between 1 and 90.");
            }

            var shifts = await scheduleRepository.GenerateShiftsAsync(scheduleId, request.ShiftCount, cancellationToken);
            return Results.Ok(shifts);
        })
        .WithName("GenerateScheduleShifts")
        .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        var shiftGroup = app.MapGroup("/api/shifts")
            .WithTags("Schedules")
            .RequireAuthorization();

        shiftGroup.MapPost("/{shiftId:guid}/swap-requests", async (
            [FromRoute] Guid shiftId,
            [FromBody] CreateSwapRequest request,
            ClaimsPrincipal user,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var requesterId = GetCurrentUserId(user);
            if (requesterId == null)
            {
                return Results.Unauthorized();
            }

            var swap = await scheduleRepository.CreateSwapRequestAsync(
                shiftId,
                requesterId.Value,
                request.TargetUserId,
                request.RequesterNote,
                cancellationToken);

            return Results.Created($"/api/swap-requests/{swap.Id}", swap);
        }).WithName("CreateShiftSwapRequest");

        var swapGroup = app.MapGroup("/api/swap-requests")
            .WithTags("Schedules")
            .RequireAuthorization(policy => policy.RequireRole("Admin", "SuperAdmin"));

        swapGroup.MapPost("/{swapRequestId:guid}/approve", async (
            [FromRoute] Guid swapRequestId,
            [FromBody] DecideSwapRequest request,
            ClaimsPrincipal user,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var decidedById = GetCurrentUserId(user);
            if (decidedById == null)
            {
                return Results.Unauthorized();
            }

            var swap = await scheduleRepository.ApproveSwapRequestAsync(
                swapRequestId,
                decidedById.Value,
                request.DecisionNote,
                cancellationToken);

            return Results.Ok(swap);
        }).WithName("ApproveSwapRequest");

        swapGroup.MapPost("/{swapRequestId:guid}/reject", async (
            [FromRoute] Guid swapRequestId,
            [FromBody] DecideSwapRequest request,
            ClaimsPrincipal user,
            [FromServices] IScheduleRepository scheduleRepository,
            CancellationToken cancellationToken) =>
        {
            var decidedById = GetCurrentUserId(user);
            if (decidedById == null)
            {
                return Results.Unauthorized();
            }

            var swap = await scheduleRepository.RejectSwapRequestAsync(
                swapRequestId,
                decidedById.Value,
                request.DecisionNote,
                cancellationToken);

            return Results.Ok(swap);
        }).WithName("RejectSwapRequest");
    }

    private static Guid? GetCurrentUserId(ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}
```

- [ ] **Step 5: Map endpoints in Program**

Add this line after `app.MapTeamEndpoints();`:

```csharp
app.MapScheduleEndpoints();
```

- [ ] **Step 6: Add EF migration**

Run:

```powershell
dotnet ef migrations add AddShiftSwapRequests --project src\alertblurty.Data --startup-project src\alertblurty.Api
```

Expected: creates a migration adding `ShiftSwapRequests` and relationship/index metadata.

- [ ] **Step 7: Run endpoint tests**

Run:

```powershell
dotnet test tests\alertblurty.Tests\alertblurty.Tests.csproj --filter ScheduleEndpointTests
```

Expected: all `ScheduleEndpointTests` pass.

- [ ] **Step 8: Commit endpoint work**

Run:

```powershell
git add src\alertblurty.Api src\alertblurty.Data src\alertblurty.Models tests\alertblurty.Tests\ScheduleEndpointTests.cs
git commit -m "feat: expose schedule and swap APIs"
```

## Task 4: Frontend API Client and Calendar Dependency

**Files:**
- Modify: `src/alertblurty.Web/package.json`
- Modify: `src/alertblurty.Web/package-lock.json`
- Modify: `src/alertblurty.Web/src/types/api.ts`
- Create: `src/alertblurty.Web/src/api/schedules.ts`

- [ ] **Step 1: Install FullCalendar packages**

Run:

```powershell
Set-Location src\alertblurty.Web
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/list @fullcalendar/interaction
Set-Location ..\..
```

Expected: `package.json` and `package-lock.json` contain the five FullCalendar packages.

- [ ] **Step 2: Add frontend schedule types**

Append these types to `src/alertblurty.Web/src/types/api.ts`:

```ts
export enum ScheduleFrequency {
  Hourly = 0,
  Daily = 1,
  Weekly = 2,
  Monthly = 3,
}

export enum ShiftSwapRequestStatus {
  Pending = 0,
  Approved = 1,
  Rejected = 2,
  Applied = 3,
}

export interface OnCallScheduleDto extends BaseDto {
  teamId: string;
  name: string;
  frequency: ScheduleFrequency;
  startTimeUtc: string;
  durationMinutes: number;
  isActive: boolean;
  teamName?: string;
}

export interface OnCallShiftDto extends BaseDto {
  scheduleId: string;
  userId: string;
  startTimeUtc: string;
  endTimeUtc: string;
  isSwapped: boolean;
  swappedWithUserId?: string;
  approvedByUserId?: string;
  userFullName?: string;
  swappedWithUserFullName?: string;
  approvedByUserFullName?: string;
  scheduleName?: string;
  hasPendingSwapRequest: boolean;
  pendingSwapRequestId?: string;
  pendingSwapTargetUserId?: string;
  pendingSwapTargetUserFullName?: string;
}

export interface ShiftSwapRequestDto extends BaseDto {
  shiftId: string;
  scheduleId: string;
  teamId: string;
  requestedByUserId: string;
  targetUserId: string;
  status: ShiftSwapRequestStatus;
  requiresApprovalSnapshot: boolean;
  requestedAtUtc: string;
  decidedAtUtc?: string;
  decidedByUserId?: string;
  requesterNote: string;
  decisionNote: string;
  requestedByUserFullName?: string;
  targetUserFullName?: string;
  decidedByUserFullName?: string;
  shiftStartTimeUtc: string;
  shiftEndTimeUtc: string;
}

export interface CreateScheduleRequest {
  name: string;
  frequency: ScheduleFrequency;
  startTimeUtc: string;
  durationMinutes: number;
}

export interface GenerateShiftsRequest {
  shiftCount: number;
}

export interface CreateSwapRequest {
  targetUserId: string;
  requesterNote: string;
}

export interface DecideSwapRequest {
  decisionNote: string;
}
```

- [ ] **Step 3: Add schedule API client**

Create `src/alertblurty.Web/src/api/schedules.ts`:

```ts
import { http } from "./http";
import type {
  CreateScheduleRequest,
  CreateSwapRequest,
  DecideSwapRequest,
  GenerateShiftsRequest,
  OnCallScheduleDto,
  OnCallShiftDto,
  ShiftSwapRequestDto,
} from "../types/api";

export async function getTeamSchedules(
  teamId: string,
): Promise<OnCallScheduleDto[]> {
  const response = await http.get<OnCallScheduleDto[]>(
    `/api/teams/${teamId}/schedules`,
  );
  return response.data;
}

export async function createTeamSchedule(
  teamId: string,
  request: CreateScheduleRequest,
): Promise<OnCallScheduleDto> {
  const response = await http.post<OnCallScheduleDto>(
    `/api/teams/${teamId}/schedules`,
    request,
  );
  return response.data;
}

export async function getScheduleShifts(
  scheduleId: string,
): Promise<OnCallShiftDto[]> {
  const response = await http.get<OnCallShiftDto[]>(
    `/api/schedules/${scheduleId}/shifts`,
  );
  return response.data;
}

export async function generateScheduleShifts(
  scheduleId: string,
  request: GenerateShiftsRequest,
): Promise<OnCallShiftDto[]> {
  const response = await http.post<OnCallShiftDto[]>(
    `/api/schedules/${scheduleId}/generate-shifts`,
    request,
  );
  return response.data;
}

export async function createShiftSwapRequest(
  shiftId: string,
  request: CreateSwapRequest,
): Promise<ShiftSwapRequestDto> {
  const response = await http.post<ShiftSwapRequestDto>(
    `/api/shifts/${shiftId}/swap-requests`,
    request,
  );
  return response.data;
}

export async function getTeamSwapRequests(
  teamId: string,
): Promise<ShiftSwapRequestDto[]> {
  const response = await http.get<ShiftSwapRequestDto[]>(
    `/api/teams/${teamId}/swap-requests`,
  );
  return response.data;
}

export async function approveSwapRequest(
  swapRequestId: string,
  request: DecideSwapRequest,
): Promise<ShiftSwapRequestDto> {
  const response = await http.post<ShiftSwapRequestDto>(
    `/api/swap-requests/${swapRequestId}/approve`,
    request,
  );
  return response.data;
}

export async function rejectSwapRequest(
  swapRequestId: string,
  request: DecideSwapRequest,
): Promise<ShiftSwapRequestDto> {
  const response = await http.post<ShiftSwapRequestDto>(
    `/api/swap-requests/${swapRequestId}/reject`,
    request,
  );
  return response.data;
}
```

- [ ] **Step 4: Run frontend typecheck**

Run:

```powershell
Set-Location src\alertblurty.Web
npm run build
Set-Location ..\..
```

Expected: build passes.

- [ ] **Step 5: Commit frontend API foundation**

Run:

```powershell
git add src\alertblurty.Web\package.json src\alertblurty.Web\package-lock.json src\alertblurty.Web\src\types\api.ts src\alertblurty.Web\src\api\schedules.ts
git commit -m "feat: add schedule frontend client"
```

## Task 5: Calendar Schedule UI

**Files:**
- Create: `src/alertblurty.Web/src/components/team-schedule/TeamSchedulePanel.tsx`
- Create: `src/alertblurty.Web/src/components/team-schedule/ScheduleFormModal.tsx`
- Create: `src/alertblurty.Web/src/components/team-schedule/ShiftDetailsModal.tsx`
- Create: `src/alertblurty.Web/src/components/team-schedule/PendingSwapRequests.tsx`
- Modify: `src/alertblurty.Web/src/pages/TeamDetailsPage.tsx`
- Modify: `src/alertblurty.Web/src/styles/alertyblurty.css`
- Create: `src/alertblurty.Web/src/components/team-schedule/TeamSchedulePanel.test.tsx`

- [ ] **Step 1: Write component tests first**

Create `TeamSchedulePanel.test.tsx` with tests named:

```ts
it("loads schedules and renders shift assignments on the calendar")
it("creates a schedule and generates shifts for admins")
it("opens shift details and submits a swap request")
it("shows pending swap requests with approve and reject actions for admins")
```

Mock `../../api/schedules`, render the component with two schedules, four team members, and shifts. Assert by accessible button names and visible user names.

- [ ] **Step 2: Run failing component tests**

Run:

```powershell
Set-Location src\alertblurty.Web
npm run test -- TeamSchedulePanel
Set-Location ..\..
```

Expected: fails because components do not exist.

- [ ] **Step 3: Build `ScheduleFormModal`**

Create `ScheduleFormModal.tsx` with props:

```ts
interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: CreateScheduleRequest) => Promise<void>;
}
```

Render a Bootstrap modal with fields `Name`, `Frequency`, `Start date and time`, and `Duration minutes`. Submit should convert `datetime-local` to `new Date(value).toISOString()`.

- [ ] **Step 4: Build `ShiftDetailsModal`**

Create `ShiftDetailsModal.tsx` with props:

```ts
interface ShiftDetailsModalProps {
  shift: OnCallShiftDto | null;
  members: TeamMemberDto[];
  currentUserId?: string;
  canManage: boolean;
  onClose: () => void;
  onRequestSwap: (shiftId: string, targetUserId: string, requesterNote: string) => Promise<void>;
  onApprove?: (swapRequestId: string) => Promise<void>;
  onReject?: (swapRequestId: string) => Promise<void>;
}
```

Show assignee, start/end times, pending swap target, and a swap form only when `shift.userId === currentUserId`. The target select should include active members except the current assignee.

- [ ] **Step 5: Build `PendingSwapRequests`**

Create `PendingSwapRequests.tsx` with props:

```ts
interface PendingSwapRequestsProps {
  requests: ShiftSwapRequestDto[];
  onApprove: (swapRequestId: string) => Promise<void>;
  onReject: (swapRequestId: string) => Promise<void>;
}
```

Filter `status === ShiftSwapRequestStatus.Pending`. Render requester, target, shift time, Approve button, and Reject button.

- [ ] **Step 6: Build `TeamSchedulePanel`**

Create `TeamSchedulePanel.tsx` with props:

```ts
interface TeamSchedulePanelProps {
  teamId: string;
  members: TeamMemberDto[];
  mayManage: boolean;
  currentUserId?: string;
}
```

Behavior:

- Load schedules with `getTeamSchedules(teamId)`.
- Select the first schedule automatically.
- Load shifts with `getScheduleShifts(selectedSchedule.id)`.
- Load pending swaps for admins with `getTeamSwapRequests(teamId)`.
- Render FullCalendar with day grid, time grid, list, and interaction plugins.
- Map shifts to events using `title: shift.userFullName ?? shift.userId`.
- Add class names `schedule-event-normal`, `schedule-event-swapped`, and `schedule-event-pending`.
- Provide buttons: `New Schedule`, `Generate Shifts`, and schedule selector.
- Generate shifts with a numeric `shiftCount` input defaulted to `14`.
- Open `ShiftDetailsModal` on event click.

- [ ] **Step 7: Import calendar styles and app styles**

In `TeamSchedulePanel.tsx`, import:

```ts
import "@fullcalendar/daygrid/index.css";
import "@fullcalendar/timegrid/index.css";
import "@fullcalendar/list/index.css";
```

If the package uses a different CSS export path, switch to the documented package CSS path that exists in `node_modules`.

Add CSS to `alertyblurty.css`:

```css
.team-schedule-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.team-schedule-calendar .fc {
  background: #fff;
}

.team-schedule-calendar .fc-toolbar-title {
  font-size: 1.2rem;
}

.schedule-event-normal {
  cursor: pointer;
}

.schedule-event-swapped {
  border-style: dashed;
}

.schedule-event-pending {
  opacity: 0.78;
}
```

- [ ] **Step 8: Wire panel into TeamDetailsPage**

Import:

```ts
import { TeamSchedulePanel } from "../components/team-schedule/TeamSchedulePanel";
```

Render below the member/statistics row:

```tsx
<TeamSchedulePanel
  currentUserId={claims?.userId}
  mayManage={mayManage}
  members={members}
  teamId={team.id}
/>
```

If `claims` does not expose `userId`, add it to the auth claim type by following the current JWT decode pattern in `src/alertblurty.Web/src/auth`.

- [ ] **Step 9: Run component tests**

Run:

```powershell
Set-Location src\alertblurty.Web
npm run test -- TeamSchedulePanel
Set-Location ..\..
```

Expected: all TeamSchedulePanel tests pass.

- [ ] **Step 10: Commit calendar UI**

Run:

```powershell
git add src\alertblurty.Web\src\components\team-schedule src\alertblurty.Web\src\pages\TeamDetailsPage.tsx src\alertblurty.Web\src\styles\alertyblurty.css
git commit -m "feat: add team schedule calendar UI"
```

## Task 6: E2E Schedule and Swap Tests

**Files:**
- Create: `src/alertblurty.Web/tests/e2e/team-schedule-swap.spec.ts`

- [ ] **Step 1: Write Playwright E2E test**

Create `team-schedule-swap.spec.ts` with one serial describe block:

```ts
import { expect, test } from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:5041";

test.describe.serial("team schedule and shift swaps", () => {
  test("manager creates a four-person rotation and exercises both swap modes", async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const password = "SecurePassword123!";
    const organizationName = `Schedule Org ${uniqueId}`;
    const managerEmail = `manager-${uniqueId}@example.com`;

    const registration = await request.post(`${apiBaseUrl}/api/auth/register`, {
      data: {
        email: managerEmail,
        password,
        fullName: "Eric Paul Manager",
        phoneNumber: "+15555551000",
        timezone: "UTC",
        organizationName,
      },
    });
    expect(registration.ok()).toBeTruthy();

    await page.goto("/login");
    await page.getByLabel("Email address").fill(managerEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("link", { name: "Users" }).click();
    for (const index of [1, 2, 3, 4]) {
      await page.getByRole("link", { name: "Create User" }).click();
      await page.getByLabel("Email").fill(`rotation-${index}-${uniqueId}@example.com`);
      await page.getByLabel("Full Name").fill(`Rotation User ${index}`);
      await page.getByLabel("Phone Number").fill(`+1555555100${index}`);
      await page.getByLabel("Password").fill(password);
      await page.getByLabel("Timezone").fill("UTC");
      await page.getByRole("button", { name: "Create User" }).click();
      await expect(page.getByText(`Rotation User ${index}`)).toBeVisible();
    }

    await page.getByRole("link", { name: "Teams" }).click();
    await page.getByRole("button", { name: "Create Team" }).click();
    await page.getByLabel("Team Name").fill(`Primary Schedule ${uniqueId}`);
    await page.getByLabel("Description").fill("Primary rotation");
    await page.getByLabel("No admin approval").check();
    await page.getByRole("button", { name: "Save Team" }).click();
    await page.getByRole("link", { name: `Primary Schedule ${uniqueId}` }).click();

    for (const index of [1, 2, 3, 4]) {
      await page.getByRole("button", { name: "Add Member" }).click();
      await page.getByLabel("Select User").selectOption({
        label: `Rotation User ${index} (rotation-${index}-${uniqueId}@example.com)`,
      });
      await page.getByLabel("Rotation Order").fill(String(index));
      await page.getByRole("button", { name: "Add Member" }).click();
      await expect(page.getByText(`Rotation User ${index}`)).toBeVisible();
    }

    await page.getByRole("button", { name: "New Schedule" }).click();
    await page.getByLabel("Name").fill("Daily Primary");
    await page.getByLabel("Frequency").selectOption("Daily");
    await page.getByLabel("Start date and time").fill("2026-06-10T09:00");
    await page.getByLabel("Duration minutes").fill("1440");
    await page.getByRole("button", { name: "Create Schedule" }).click();

    await page.getByLabel("Shift count").fill("8");
    await page.getByRole("button", { name: "Generate Shifts" }).click();
    await expect(page.getByText("Rotation User 1").first()).toBeVisible();
    await expect(page.getByText("Rotation User 4").first()).toBeVisible();

    await page.getByText("Rotation User 1").first().click();
    await page.getByLabel("Swap with").selectOption({
      label: `Rotation User 2`,
    });
    await page.getByLabel("Note").fill("Immediate swap e2e");
    await page.getByRole("button", { name: "Request Swap" }).click();
    await expect(page.getByText("Swap applied")).toBeVisible();

    await page.getByLabel("Admin approval only").check();
    await page.getByText("Rotation User 3").first().click();
    await page.getByLabel("Swap with").selectOption({
      label: `Rotation User 4`,
    });
    await page.getByLabel("Note").fill("Approval swap e2e");
    await page.getByRole("button", { name: "Request Swap" }).click();
    await expect(page.getByText("Pending swap")).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Swap approved")).toBeVisible();
  });
});
```

Adjust selectors to the final accessible labels from the implemented UI while preserving the scenario.

- [ ] **Step 2: Run E2E test against local servers**

Start the API and web dev server in separate shells:

```powershell
dotnet run --project src\alertblurty.Api
```

```powershell
Set-Location src\alertblurty.Web
npm run dev
```

Then run:

```powershell
Set-Location src\alertblurty.Web
npm run e2e -- team-schedule-swap.spec.ts
Set-Location ..\..
```

Expected: the new E2E test passes.

- [ ] **Step 3: Commit E2E test**

Run:

```powershell
git add src\alertblurty.Web\tests\e2e\team-schedule-swap.spec.ts
git commit -m "test: cover team schedule swap workflow e2e"
```

## Task 7: Usability Evaluation Artifact

**Files:**
- Create: `docs/evaluations/team-schedule-swap-usability.md`

- [ ] **Step 1: Capture screenshots during E2E run**

Add temporary `await page.screenshot({ path: "test-results/team-schedule-calendar.png", fullPage: true });` statements locally while evaluating, or use Playwright trace artifacts from the passing run. Remove temporary screenshot code before committing unless it is part of the test assertion.

- [ ] **Step 2: Write evaluation**

Create `docs/evaluations/team-schedule-swap-usability.md`:

```markdown
# Team Schedule Swap Usability Evaluation

Date: 2026-06-10

## Scenario

Created a manager, four users, one team, a daily rotation schedule, eight generated shifts, one immediate swap, and one admin-approved swap.

## Findings

- Team creation and member assignment:
- Schedule creation and generation:
- Calendar readability:
- Swap request discoverability:
- Approval-mode clarity:
- Pending/approved/rejected visual clarity:

## Friction

- Record the concrete points where the workflow took extra clicks, used unclear labels, or made it hard to find the next action. If no friction is found, write "No material friction observed in this pass."

## Recommended Follow-Ups

- Record concrete improvements that are outside this MVP. If no follow-ups are needed, write "No follow-ups recommended from this pass."
```

Fill each bullet with the observed finding from the implemented UI. Keep screenshots and report free of secrets and private phone numbers.

- [ ] **Step 3: Commit evaluation**

Run:

```powershell
git add docs\evaluations\team-schedule-swap-usability.md
git commit -m "docs: evaluate team schedule swap usability"
```

## Task 8: Full Verification

**Files:**
- All modified files

- [ ] **Step 1: Run backend tests**

Run:

```powershell
dotnet test alertblurty.sln
```

Expected: all backend tests pass.

- [ ] **Step 2: Run frontend unit tests**

Run:

```powershell
Set-Location src\alertblurty.Web
npm run test
Set-Location ..\..
```

Expected: all Vitest tests pass.

- [ ] **Step 3: Run frontend build**

Run:

```powershell
Set-Location src\alertblurty.Web
npm run build
Set-Location ..\..
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 4: Run Playwright E2E tests**

With API and Vite dev server running:

```powershell
Set-Location src\alertblurty.Web
npm run e2e
Set-Location ..\..
```

Expected: existing auth E2E and new schedule/swap E2E pass.

- [ ] **Step 5: Review git status**

Run:

```powershell
git status --short
```

Expected: only intentional tracked changes are present. The unrelated untracked `.superpowers/` directory may still appear and should not be committed unless the user explicitly asks for it.

- [ ] **Step 6: Final commit if verification caused fixes**

If verification required fixes after the last feature commit, run:

```powershell
git add src tests docs
git commit -m "fix: stabilize team schedule swap workflow"
```

Expected: no remaining uncommitted feature changes except intentionally ignored artifacts.

## Self-Review Notes

- Spec coverage: backend schedules, calendar UI, admin approval mode, immediate swaps, pending swaps, E2E tests, and usability evaluation are covered.
- Type consistency: request/DTO names match the spec and are introduced before frontend/API use.
- Scope: this plan stays within the MVP and excludes PTO, availability, notifications, and advanced schedule exceptions.
