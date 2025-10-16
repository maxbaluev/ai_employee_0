import type { Meta, StoryObj } from "@storybook/react";

import { AlertRail } from "./AlertRail";

const meta: Meta<typeof AlertRail> = {
  title: "Workspace/Home/AlertRail",
  component: AlertRail,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof AlertRail>;

export const WithAlerts: Story = {
  args: {
    alerts: [
      {
        id: "alert-1",
        missionId: "mission-platform",
        message: "Validator escalation pending: confirm Vercel override.",
        severity: "critical",
        nextStep: "Review escalation",
        href: "/workspace/plan",
      },
      {
        id: "alert-2",
        missionId: "mission-compliance",
        message: "Evidence hashes lagging 12 hours behind schedule.",
        severity: "warning",
        nextStep: "Open evidence checklist",
        href: "/workspace/reflect",
      },
    ],
  },
};

export const NoAlerts: Story = {
  args: {
    alerts: [],
  },
};
