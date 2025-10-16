import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MissionAlert } from "@/lib/types/mission";

import { AlertRail } from "../AlertRail";

const ALERTS: MissionAlert[] = [
  {
    id: "alert-1",
    missionId: "mission-1",
    message: "Validator escalation pending",
    severity: "critical",
    nextStep: "Open escalation",
    href: "/workspace/plan",
  },
];

afterEach(cleanup);

describe("AlertRail", () => {
  it("renders alerts with severity styling", () => {
    render(<AlertRail alerts={ALERTS} />);

    expect(screen.getByText("Validator escalation pending")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to mission/i })).toHaveAttribute(
      "href",
      "/workspace/plan",
    );
  });

  it("emits telemetry when alerts are viewed", async () => {
    const onAlertsViewed = vi.fn();

    render(<AlertRail alerts={ALERTS} onAlertsViewed={onAlertsViewed} />);

    await waitFor(() => {
      expect(onAlertsViewed).toHaveBeenCalledWith(ALERTS);
    });
  });
});
