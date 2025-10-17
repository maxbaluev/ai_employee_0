import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { ApprovalDecisionPanel } from "./ApprovalDecisionPanel";
import { ApprovalHistoryTimeline } from "./ApprovalHistoryTimeline";
import { ApprovalSummaryCard } from "./ApprovalSummaryCard";

const baseSummary = {
  whatWillHappen: "Reach 83 manufacturing CFOs over three days with personalized reactivation outreach",
  whoIsAffected: {
    recordCount: 83,
    segments: ["Manufacturing CFOs", "Dormant >90 days", "High-value accounts"],
    dataSources: ["HubSpot", "Gmail"],
  },
  safeguards: [
    {
      id: "sg-1",
      category: "Rate limiting",
      description: "Limit outreach to 30 contacts per hour to avoid spam penalties",
      severity: "high" as const,
    },
    {
      id: "sg-2",
      category: "PII protection",
      description: "Mask customer emails before logging evidence",
      severity: "critical" as const,
    },
  ],
  undoPlan: {
    id: "undo-1",
    label: "Rollback outreach",
    impactSummary: "Cancels unsent emails and produces an audit report of deliveries",
    windowMinutes: 15,
    steps: [
      "Cancel outstanding email sequences",
      "Notify account owners",
      "Publish rollback report",
    ],
  },
  requiredPermissions: [
    {
      toolkit: "HubSpot",
      scopes: ["contacts.read", "contacts.write", "campaigns.send"],
    },
    {
      toolkit: "Gmail",
      scopes: ["gmail.compose", "gmail.send"],
    },
  ],
};

const history = [
  {
    id: "hist-1",
    action: "requested" as const,
    actor: "Riley Patterson",
    actorRole: "RevOps Lead",
    timestamp: "2025-10-16T17:11:00.000Z",
    note: "Generated play ready for review",
  },
  {
    id: "hist-2",
    action: "delegated" as const,
    actor: "Riley Patterson",
    actorRole: "RevOps Lead",
    timestamp: "2025-10-16T17:25:00.000Z",
    note: "Delegated to governance for scope confirmation",
  },
  {
    id: "hist-3",
    action: "approved" as const,
    actor: "Gabriela Ortiz",
    actorRole: "Governance Officer",
    timestamp: "2025-10-16T17:45:00.000Z",
    note: "Safeguards confirmed. Ready for execution.",
  },
];

const comments = [
  {
    id: "comment-1",
    author: "Gabriela Ortiz",
    authorRole: "Governance Officer",
    content: "Undo window looks good. Please ensure validator alerting is active.",
    timestamp: "2025-10-16T17:30:00.000Z",
  },
];

const summaryMeta: Meta<typeof ApprovalSummaryCard> = {
  title: "Workspace/Approve/ApprovalSummaryCard",
  component: ApprovalSummaryCard,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark", values: [{ name: "dark", value: "#0f172a" }] },
  },
  tags: ["autodocs"],
};

export default summaryMeta;

type SummaryStory = StoryObj<typeof ApprovalSummaryCard>;

export const DefaultSummary: SummaryStory = {
  args: { summary: baseSummary },
};

export const ExtensiveSafeguards: SummaryStory = {
  args: {
    summary: {
      ...baseSummary,
      safeguards: [
        ...baseSummary.safeguards,
        {
          id: "sg-3",
          category: "Quiet hours",
          description: "Respect quiet hours for EMEA accounts",
          severity: "medium" as const,
        },
      ],
    },
  },
};

const decisionMeta: Meta<typeof ApprovalDecisionPanel> = {
  title: "Workspace/Approve/ApprovalDecisionPanel",
  component: ApprovalDecisionPanel,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark", values: [{ name: "dark", value: "#0f172a" }] },
  },
  tags: ["autodocs"],
};

export const RequestedDecision: StoryObj<typeof ApprovalDecisionPanel> = {
  ...decisionMeta,
  args: {
    approvalId: "approval-demo",
    missionId: "mission-demo",
    status: "requested",
    onApprove: fn(),
    onReject: fn(),
    onDelegate: fn(),
    onExport: fn(),
  },
};

export const ApprovedDecision: StoryObj<typeof ApprovalDecisionPanel> = {
  ...decisionMeta,
  args: {
    ...RequestedDecision.args,
    status: "approved",
  },
};

export const DelegatedDecision: StoryObj<typeof ApprovalDecisionPanel> = {
  ...decisionMeta,
  args: {
    ...RequestedDecision.args,
    status: "delegated",
  },
};

const historyMeta: Meta<typeof ApprovalHistoryTimeline> = {
  title: "Workspace/Approve/ApprovalHistoryTimeline",
  component: ApprovalHistoryTimeline,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark", values: [{ name: "dark", value: "#0f172a" }] },
  },
  tags: ["autodocs"],
};

export const RichHistory: StoryObj<typeof ApprovalHistoryTimeline> = {
  ...historyMeta,
  args: {
    history,
    comments,
    onAddComment: fn(),
  },
};

export const EmptyHistory: StoryObj<typeof ApprovalHistoryTimeline> = {
  ...historyMeta,
  args: {
    history: [],
    comments: [],
    onAddComment: fn(),
  },
};
