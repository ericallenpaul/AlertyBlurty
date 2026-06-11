import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const apiBaseUrl =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://127.0.0.1:5041";

type UserContext = {
  id: string;
  email: string;
  fullName: string;
  token: string;
};

type TeamContext = {
  id: string;
  name: string;
};

test.describe.serial("team schedule swaps", () => {
  test("covers auto-approved and admin-approved swaps with one admin and four members", async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now();
    const admin = await registerAdmin(request, uniqueId);
    const members = await createMembers(request, admin, uniqueId);
    const autoTeam = await createTeam(request, admin.token, {
      name: `Auto Swap Team ${uniqueId}`,
      requireAdminApprovalForSwaps: false,
    });
    const approvalTeam = await createTeam(request, admin.token, {
      name: `Approval Swap Team ${uniqueId}`,
      requireAdminApprovalForSwaps: true,
    });

    await addMembersToTeam(request, admin.token, autoTeam.id, members);
    await addMembersToTeam(request, admin.token, approvalTeam.id, members);

    await loginWithToken(page, admin.token);
    await createScheduleFromUi(page, autoTeam);
    await createScheduleFromUi(page, approvalTeam);

    await loginWithToken(page, members[0].token);
    await requestSwapFromUi(page, autoTeam, members[1].fullName);
    await expect(page.getByText("Swap request submitted.")).toBeVisible();
    await expect(page.getByText(members[1].fullName).first()).toBeVisible();
    await expect(page.getByText("Swapped").first()).toBeVisible();

    await loginWithToken(page, members[0].token);
    await requestSwapFromUi(page, approvalTeam, members[1].fullName);
    await expect(page.getByText("Swap request submitted.")).toBeVisible();
    await expect(
      page.getByText(`Pending swap to ${members[1].fullName}`).first(),
    ).toBeVisible();

    await loginWithToken(page, admin.token);
    await page.goto(`/teams/${approvalTeam.id}`);
    await expect(
      page.getByText(`${members[0].fullName} to ${members[1].fullName}`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Swap approved.")).toBeVisible();
    await expect(page.getByText(members[1].fullName).first()).toBeVisible();
    await expect(page.getByText("Swapped").first()).toBeVisible();
  });
});

async function registerAdmin(
  request: APIRequestContext,
  uniqueId: number,
): Promise<UserContext> {
  const email = `schedule-admin-${uniqueId}@example.com`;
  const password = "SecurePassword123!";
  const response = await request.post(`${apiBaseUrl}/api/auth/register`, {
    data: {
      email,
      password,
      fullName: "Schedule Admin",
      phoneNumber: "+15555550123",
      timezone: "UTC",
      organizationName: `Schedule Swap Org ${uniqueId}`,
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return {
    id: body.data.user.id,
    email,
    fullName: body.data.user.fullName,
    token: body.data.token,
  };
}

async function createMembers(
  request: APIRequestContext,
  admin: UserContext,
  uniqueId: number,
): Promise<UserContext[]> {
  const users: UserContext[] = [];

  for (let index = 1; index <= 4; index += 1) {
    const email = `schedule-member-${index}-${uniqueId}@example.com`;
    const password = "SecurePassword123!";
    const userResponse = await request.post(`${apiBaseUrl}/api/users`, {
      headers: authorization(admin.token),
      data: {
        organizationId: await getOrganizationIdFromTokenUser(
          request,
          admin.token,
        ),
        email,
        password,
        fullName: `Schedule Member ${index}`,
        phoneNumber: `+1555555012${index}`,
        timezone: "UTC",
        role: 0,
        isActive: true,
      },
    });
    expect(userResponse.ok()).toBeTruthy();
    const user = await userResponse.json();

    const loginResponse = await request.post(`${apiBaseUrl}/api/auth/login`, {
      data: { email, password },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const login = await loginResponse.json();

    users.push({
      id: user.id,
      email,
      fullName: user.fullName,
      token: login.data.token,
    });
  }

  return users;
}

async function getOrganizationIdFromTokenUser(
  request: APIRequestContext,
  token: string,
): Promise<string> {
  const response = await request.get(`${apiBaseUrl}/api/users/me`, {
    headers: authorization(token),
  });
  expect(response.ok()).toBeTruthy();
  const user = await response.json();
  return user.organizationId;
}

async function createTeam(
  request: APIRequestContext,
  token: string,
  team: { name: string; requireAdminApprovalForSwaps: boolean },
): Promise<TeamContext> {
  const response = await request.post(`${apiBaseUrl}/api/teams`, {
    headers: authorization(token),
    data: {
      name: team.name,
      description: "Playwright schedule swap team",
      requireAdminApprovalForSwaps: team.requireAdminApprovalForSwaps,
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return { id: body.id, name: body.name };
}

async function addMembersToTeam(
  request: APIRequestContext,
  token: string,
  teamId: string,
  members: UserContext[],
) {
  for (const [index, member] of members.entries()) {
    const response = await request.post(
      `${apiBaseUrl}/api/teams/${teamId}/members`,
      {
        headers: authorization(token),
        data: { userId: member.id, rotationOrder: index + 1 },
      },
    );
    expect(response.ok()).toBeTruthy();
  }
}

async function loginWithToken(page: Page, token: string) {
  await page.goto("/");
  await page.evaluate((authToken) => {
    window.localStorage.setItem("authToken", authToken);
  }, token);
}

async function createScheduleFromUi(page: Page, team: TeamContext) {
  await page.goto(`/teams/${team.id}`);
  await expect(page.getByRole("heading", { name: team.name })).toBeVisible();
  await page.getByLabel("Schedule name").fill("Primary");
  await page.getByRole("button", { name: "Create Schedule" }).click();
  await expect(
    page.getByText("Schedule created and shifts generated."),
  ).toBeVisible();
  await expect(page.getByText("Schedule Member 1").first()).toBeVisible();
}

async function requestSwapFromUi(
  page: Page,
  team: TeamContext,
  targetFullName: string,
) {
  await page.goto(`/teams/${team.id}`);
  await expect(page.getByRole("heading", { name: team.name })).toBeVisible();
  await page
    .getByLabel("Swap target")
    .first()
    .selectOption({ label: targetFullName });
  await page.getByRole("button", { name: "Request Swap" }).first().click();
}

function authorization(token: string) {
  return { Authorization: `Bearer ${token}` };
}
