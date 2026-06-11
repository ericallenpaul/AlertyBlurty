import { AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it } from "vitest";

import { http } from "./http";

describe("http client", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds the bearer token from token storage to outgoing requests", async () => {
    window.localStorage.setItem("authToken", "abc123");

    const response = await http.get("/probe", {
      adapter: async (config) => ({
        config,
        data: null,
        headers: {},
        status: 200,
        statusText: "OK",
      }),
    });

    expect(
      AxiosHeaders.from(response.config.headers).get("Authorization"),
    ).toBe("Bearer abc123");
  });

  it("clears the stored token when the API rejects it", async () => {
    window.localStorage.setItem("authToken", "stale-token");

    await expect(
      http.get("/probe", {
        adapter: async (config) =>
          Promise.reject({
            config,
            isAxiosError: true,
            response: {
              config,
              data: null,
              headers: {},
              status: 401,
              statusText: "Unauthorized",
            },
          }),
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(window.localStorage.getItem("authToken")).toBeNull();
  });
});
