import { afterEach, describe, expect, it, vi } from "vitest";

import { http } from "./http";
import { bootstrapSetup, getSetupStatus } from "./setup";

describe("setup api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gets setup status from the setup endpoint", async () => {
    vi.spyOn(http, "get").mockResolvedValue({
      data: {
        isConfigured: false,
        databaseConfigured: false,
        databaseReachable: false,
        twilioConfigured: false,
        jwtConfigured: true,
        hasOrganizations: false,
      },
    });

    await expect(getSetupStatus()).resolves.toMatchObject({
      isConfigured: false,
      jwtConfigured: true,
    });
  });

  it("posts database fields and twilio settings to bootstrap setup", async () => {
    const post = vi.spyOn(http, "post").mockResolvedValue({ data: {} });

    await bootstrapSetup({
      database: {
        server: "postgres",
        port: 5432,
        databaseName: "alertyblurty",
        username: "alerty_app",
        password: "secret",
      },
      twilio: {
        accountSid: "AC123",
        authToken: "twilio-secret",
        phoneNumber: "+15555550100",
      },
    });

    expect(post).toHaveBeenCalledWith("/api/setup/bootstrap", {
      database: {
        server: "postgres",
        port: 5432,
        databaseName: "alertyblurty",
        username: "alerty_app",
        password: "secret",
      },
      twilio: {
        accountSid: "AC123",
        authToken: "twilio-secret",
        phoneNumber: "+15555550100",
      },
    });
  });
});
