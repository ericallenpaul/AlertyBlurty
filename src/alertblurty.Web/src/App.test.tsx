import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the React migration shell", () => {
    render(<App />);

    expect(
      screen.getByText("AlertyBlurty React migration shell"),
    ).toBeVisible();
  });
});
