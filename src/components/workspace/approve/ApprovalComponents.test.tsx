import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApprovalDecisionPanel } from "./ApprovalDecisionPanel";
import { ApprovalHistoryTimeline } from "./ApprovalHistoryTimeline";
import { ApprovalSummaryCard } from "./ApprovalSummaryCard";

vi.mock("@/lib/telemetry/client", () => ({
  emitTelemetry: vi.fn(),
}));

describe("ApprovalSummaryCard", () => {
  const summary = {
    whatWillHappen: "Send reactivation outreach to dormant customers",
    whoIsAffected: {
      recordCount: 42,
      segments: ["Dormant >90 days", "North America"],
      dataSources: ["HubSpot", "Gmail"],
    },
    safeguards: [
      {
        id: "sg-safe",
        category: "Rate limiting",
        description: "Limit outreach to 30 contacts per hour",
        severity: "medium" as const,
      },
    ],
    undoPlan: {
      id: "undo-1",
      label: "Pause reactivation campaign",
      impactSummary: "Cancels scheduled emails and notifies account owners",
      windowMinutes: 15,
      steps: ["Cancel pending emails", "Notify owners", "Generate rollback report"],
    },
    requiredPermissions: [
      {
        toolkit: "HubSpot",
        scopes: ["contacts.read", "contacts.write"],
      },
    ],
  };

  it("renders mission summary content", () => {
    render(<ApprovalSummaryCard summary={summary} />);

    expect(screen.getByText(summary.whatWillHappen)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/Dormant >/)).toBeInTheDocument();
  });

  it("shows safeguards and undo plan details", () => {
    render(<ApprovalSummaryCard summary={summary} />);

    expect(screen.getByText("Rate limiting")).toBeInTheDocument();
    expect(screen.getByText("15-minute window")).toBeInTheDocument();
    expect(screen.getByText("contacts.read")).toBeInTheDocument();
  });
});

describe("ApprovalDecisionPanel", () => {
  const baseProps = {
    approvalId: "approval-1",
    missionId: "mission-1",
    status: "requested" as const,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onDelegate: vi.fn(),
    onExport: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("submits approval rationale", async () => {
    const user = userEvent.setup();
    render(<ApprovalDecisionPanel {...baseProps} />);

    await user.type(
      screen.getByLabelText(/rationale/i),
      "Scope aligns with granted permissions",
    );
    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(baseProps.onApprove).toHaveBeenCalledWith("Scope aligns with granted permissions");
    });
  });

  it("requires rationale when rejecting", async () => {
    const user = userEvent.setup();
    render(<ApprovalDecisionPanel {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(await screen.findByText(/provide a rationale/i)).toBeInTheDocument();
    expect(baseProps.onReject).not.toHaveBeenCalled();
  });

  it("delegates to another role", async () => {
    const user = userEvent.setup();
    render(<ApprovalDecisionPanel {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /delegate to another approver/i }));
    await user.type(screen.getByLabelText(/delegate to role/i), "governance");
    await user.type(screen.getByLabelText(/reason/i), "Requires compliance review");
    await user.click(screen.getByRole("button", { name: "Delegate approval" }));

    await waitFor(() => {
      expect(baseProps.onDelegate).toHaveBeenCalledWith("governance", "Requires compliance review");
    });
  });

  it("disables actions once resolved", () => {
    render(<ApprovalDecisionPanel {...baseProps} status="approved" />);

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.getByText(/approved/i)).toBeInTheDocument();
  });

  it("triggers export handler", async () => {
    const user = userEvent.setup();
    render(<ApprovalDecisionPanel {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /export to pdf/i }));

    expect(baseProps.onExport).toHaveBeenCalledTimes(1);
  });
});

describe("ApprovalHistoryTimeline", () => {
  const history = [
    {
      id: "event-1",
      action: "requested" as const,
      actor: "Riley Patterson",
      actorRole: "RevOps",
      timestamp: "2025-10-16T12:00:00.000Z",
    },
  ];

  const comments = [
    {
      id: "comment-1",
      author: "Sam Torres",
      authorRole: "Support",
      content: "Please double-check quiet hours",
      timestamp: "2025-10-16T13:30:00.000Z",
    },
  ];

  it("renders history and comments", () => {
    render(<ApprovalHistoryTimeline history={history} comments={comments} />);

    expect(screen.getByText("Riley Patterson")).toBeInTheDocument();
    expect(screen.getByText("Sam Torres")).toBeInTheDocument();
    expect(screen.getByText(/quiet hours/)).toBeInTheDocument();
  });

  it("submits new comments", async () => {
    const onAddComment = vi.fn();
    render(
      <ApprovalHistoryTimeline
        history={history}
        comments={comments}
        onAddComment={onAddComment}
      />,
    );

    fireEvent.change(screen.getByLabelText(/add a comment/i), {
      target: { value: "Need validator review" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith("Need validator review");
    });
  });

  it("shows empty state when no activity recorded", () => {
    render(<ApprovalHistoryTimeline history={[]} comments={[]} />);

    expect(screen.getByText(/no activity captured yet/i)).toBeInTheDocument();
  });
});
