import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MissionSummary } from "@/lib/types/mission";

import { MissionList } from "../MissionList";

const MOCK_MISSIONS: MissionSummary[] = [
  {
    id: "mission-1",
    title: "Q4 Reactivation",
    stage: "plan",
    owner: "Riley",
    persona: "RevOps",
    readiness: "ready",
    nextAction: "Review plays",
    updatedAt: "2025-10-15T18:32:00.000Z",
  },
  {
    id: "mission-2",
    title: "Support Surge",
    stage: "prepare",
    owner: "Sam",
    persona: "Support",
    readiness: "needs-auth",
    nextAction: "Refresh Zendesk OAuth",
    updatedAt: "2025-10-15T17:12:00.000Z",
  },
];

afterEach(cleanup);

describe("MissionList", () => {
  it("renders missions with readiness badges", () => {
    render(<MissionList missions={MOCK_MISSIONS} />);

    expect(screen.getByRole("table", { name: /my missions/i })).toBeInTheDocument();
    expect(screen.getByText("Q4 Reactivation")).toBeInTheDocument();
    expect(screen.getByText("Support Surge")).toBeInTheDocument();
    expect(screen.getAllByText(/Ready|Needs auth/)).toHaveLength(2);
  });

  it("invokes callbacks for mission selection and readiness telemetry", () => {
    const onSelect = vi.fn();
    const onBadgeVisible = vi.fn();

    render(
      <MissionList
        missions={MOCK_MISSIONS}
        onMissionSelect={onSelect}
        onBadgeVisible={onBadgeVisible}
      />,
    );

    const missionButton = screen.getByRole("button", {
      name: "Open Q4 Reactivation",
    });
    fireEvent.click(missionButton);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ id: "mission-1" });
    expect(onBadgeVisible).toHaveBeenCalledTimes(MOCK_MISSIONS.length);
  });
});
