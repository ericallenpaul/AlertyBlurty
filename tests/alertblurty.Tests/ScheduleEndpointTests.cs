using System.Net.Http.Headers;
using System.Net.Http.Json;
using alertblurty.Models.DTOs;
using alertblurty.Models.Requests.Auth;
using alertblurty.Models.Requests.Schedules;
using alertblurty.Models.Requests.Teams;
using alertblurty.Models.Requests.Users;
using alertblurty.Models.Responses;
using FluentAssertions;

namespace alertblurty.Tests;

public class ScheduleEndpointTests
{
    [Fact]
    public async Task AutoApprovalTeam_Allows_assigned_user_to_swap_shift_immediately()
    {
        Environment.SetEnvironmentVariable("JWT_SECRET", "test-secret-with-enough-length-for-hmac-signing");

        await using var factory = new AlertBlurtyApiFactory();
        using var client = factory.CreateClient();
        var context = await SeedScheduleWorkflowAsync(client, requireApproval: false);
        var assignedUser = context.Users[0];
        var targetUser = context.Users[1];

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", assignedUser.Token);
        var swapResponse = await client.PostAsJsonAsync(
            $"/api/shifts/{context.Shifts[0].Id}/swap-requests",
            new CreateSwapRequest { TargetUserId = targetUser.User.Id, RequesterNote = "Please cover this shift" });

        var swap = await ReadSuccessfulJsonAsync<ShiftSwapRequestDto>(swapResponse);
        swap.Status.Should().Be(ShiftSwapRequestStatus.Applied);
        swap.RequiresApprovalSnapshot.Should().BeFalse();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", context.AdminToken);
        var shifts = await client.GetFromJsonAsync<List<OnCallShiftDto>>($"/api/schedules/{context.Schedule.Id}/shifts");
        shifts.Should().NotBeNull();
        shifts!.Single().UserId.Should().Be(targetUser.User.Id);
        shifts.Single().IsSwapped.Should().BeTrue();
        shifts.Single().SwappedWithUserId.Should().Be(assignedUser.User.Id);
    }

    [Fact]
    public async Task ApprovalRequiredTeam_Keeps_swap_pending_until_admin_approves()
    {
        Environment.SetEnvironmentVariable("JWT_SECRET", "test-secret-with-enough-length-for-hmac-signing");

        await using var factory = new AlertBlurtyApiFactory();
        using var client = factory.CreateClient();
        var context = await SeedScheduleWorkflowAsync(client, requireApproval: true);
        var assignedUser = context.Users[0];
        var targetUser = context.Users[1];

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", assignedUser.Token);
        var swapResponse = await client.PostAsJsonAsync(
            $"/api/shifts/{context.Shifts[0].Id}/swap-requests",
            new CreateSwapRequest { TargetUserId = targetUser.User.Id });

        var swap = await ReadSuccessfulJsonAsync<ShiftSwapRequestDto>(swapResponse);
        swap.Status.Should().Be(ShiftSwapRequestStatus.Pending);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", context.AdminToken);
        var pendingShifts = await client.GetFromJsonAsync<List<OnCallShiftDto>>($"/api/schedules/{context.Schedule.Id}/shifts");
        pendingShifts.Should().NotBeNull();
        pendingShifts!.Single().UserId.Should().Be(assignedUser.User.Id);
        pendingShifts.Single().PendingSwapTargetUserId.Should().Be(targetUser.User.Id);

        var approveResponse = await client.PostAsJsonAsync(
            $"/api/swap-requests/{swap.Id}/approve",
            new DecideSwapRequest { DecisionNote = "Approved" });

        var approved = await ReadSuccessfulJsonAsync<ShiftSwapRequestDto>(approveResponse);
        approved.Status.Should().Be(ShiftSwapRequestStatus.Approved);

        var approvedShifts = await client.GetFromJsonAsync<List<OnCallShiftDto>>($"/api/schedules/{context.Schedule.Id}/shifts");
        approvedShifts.Should().NotBeNull();
        approvedShifts!.Single().UserId.Should().Be(targetUser.User.Id);
        approvedShifts.Single().ApprovedByUserId.Should().NotBeNull();
    }

    [Fact]
    public async Task GenerateShifts_Allows_admin_to_generate_for_date_range()
    {
        Environment.SetEnvironmentVariable("JWT_SECRET", "test-secret-with-enough-length-for-hmac-signing");

        await using var factory = new AlertBlurtyApiFactory();
        using var client = factory.CreateClient();
        var context = await SeedScheduleWorkflowAsync(client, requireApproval: false);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", context.AdminToken);
        var generateResponse = await client.PostAsJsonAsync(
            $"/api/schedules/{context.Schedule.Id}/generate-shifts",
            new GenerateShiftsRequest { EndTimeUtc = new DateTime(2026, 6, 15, 0, 0, 0, DateTimeKind.Utc) });

        var shifts = await ReadSuccessfulJsonAsync<List<OnCallShiftDto>>(generateResponse);
        shifts.Should().HaveCount(4);
        shifts.Last().EndTimeUtc.Should().Be(new DateTime(2026, 6, 15, 0, 0, 0, DateTimeKind.Utc));
    }

    private static async Task<ScheduleWorkflowContext> SeedScheduleWorkflowAsync(HttpClient client, bool requireApproval)
    {
        var uniqueId = Guid.NewGuid().ToString("N");
        var registerResponse = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            Email = $"admin-{uniqueId}@example.com",
            Password = "Passw0rd!",
            FullName = "Workflow Admin",
            PhoneNumber = "+15555550123",
            Timezone = "UTC",
            OrganizationName = $"Workflow Org {uniqueId}"
        });

        var auth = await ReadSuccessfulApiResponseAsync<AuthResponse>(registerResponse);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.Token);

        var users = new List<UserWithToken>();
        for (var index = 1; index <= 4; index++)
        {
            var userResponse = await client.PostAsJsonAsync("/api/users", new CreateUserRequest
            {
                OrganizationId = auth.User.OrganizationId,
                Email = $"member{index}-{uniqueId}@example.com",
                Password = "Passw0rd!",
                FullName = $"Member {index}",
                PhoneNumber = $"+1555555012{index}",
                Timezone = "UTC",
                Role = UserRole.User,
                IsActive = true
            });
            var user = await ReadSuccessfulJsonAsync<UserDto>(userResponse);

            var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
            {
                Email = user.Email,
                Password = "Passw0rd!"
            });
            var login = await ReadSuccessfulApiResponseAsync<AuthResponse>(loginResponse);
            users.Add(new UserWithToken(user, login.Token));
        }

        var teamResponse = await client.PostAsJsonAsync("/api/teams", new CreateTeamRequest
        {
            Name = requireApproval ? "Approval Team" : "Auto Team",
            Description = "Schedule endpoint test team",
            RequireAdminApprovalForSwaps = requireApproval
        });
        var team = await ReadSuccessfulJsonAsync<TeamDto>(teamResponse);

        for (var index = 0; index < users.Count; index++)
        {
            var memberResponse = await client.PostAsJsonAsync(
                $"/api/teams/{team.Id}/members",
                new AddTeamMemberRequest { UserId = users[index].User.Id, RotationOrder = index + 1 });
            memberResponse.IsSuccessStatusCode.Should().BeTrue(await memberResponse.Content.ReadAsStringAsync());
        }

        var scheduleResponse = await client.PostAsJsonAsync("/api/schedules", new CreateScheduleRequest
        {
            TeamId = team.Id,
            Name = "Primary",
            Frequency = ScheduleFrequency.Daily,
            StartTimeUtc = new DateTime(2026, 6, 11, 0, 0, 0, DateTimeKind.Utc),
            DurationMinutes = 1440
        });
        var schedule = await ReadSuccessfulJsonAsync<OnCallScheduleDto>(scheduleResponse);

        var generateResponse = await client.PostAsJsonAsync(
            $"/api/schedules/{schedule.Id}/generate-shifts",
            new GenerateShiftsRequest { Count = 1 });
        var shifts = await ReadSuccessfulJsonAsync<List<OnCallShiftDto>>(generateResponse);

        return new ScheduleWorkflowContext(auth.Token, team, schedule, shifts, users);
    }

    private static async Task<T> ReadSuccessfulApiResponseAsync<T>(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        response.IsSuccessStatusCode.Should().BeTrue(content);
        var apiResponse = await response.Content.ReadFromJsonAsync<ApiResponse<T>>();
        apiResponse.Should().NotBeNull();
        apiResponse!.Success.Should().BeTrue();
        apiResponse.Data.Should().NotBeNull();
        return apiResponse.Data!;
    }

    private static async Task<T> ReadSuccessfulJsonAsync<T>(HttpResponseMessage response)
    {
        var content = await response.Content.ReadAsStringAsync();
        response.IsSuccessStatusCode.Should().BeTrue(content);
        var value = await response.Content.ReadFromJsonAsync<T>();
        value.Should().NotBeNull();
        return value!;
    }

    private sealed record UserWithToken(UserDto User, string Token);

    private sealed record ScheduleWorkflowContext(
        string AdminToken,
        TeamDto Team,
        OnCallScheduleDto Schedule,
        List<OnCallShiftDto> Shifts,
        List<UserWithToken> Users);
}
