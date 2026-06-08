import { afterEach, describe, expect, it, vi } from "vitest";

import { http } from "./http";
import { hasOrganizations } from "./organizations";

describe("organizations api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when the organizations endpoint is not found", async () => {
    vi.spyOn(http, "get").mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 404,
      },
    });

    await expect(hasOrganizations()).resolves.toBe(false);
  });
});
