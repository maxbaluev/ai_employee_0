import type { Meta, StoryObj } from "@storybook/react";

import { MissionList } from "./MissionList";

const meta: Meta<typeof MissionList> = {
  title: "Workspace/Home/MissionList",
  component: MissionList,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof MissionList>;

export const Default: Story = {
  args: {
    missions: [
      {
        id: "mission-q4",
        title: "Q4 Reactivation",
        stage: "plan",
        owner: "Riley Patterson",
        persona: "RevOps",
        readiness: "ready",
        nextAction: "Review ranked plays",
        updatedAt: "2025-10-15T18:32:00.000Z",
      },
      {
        id: "mission-support",
        title: "Support Surge",
        stage: "prepare",
        owner: "Sam Torres",
        persona: "Support",
        readiness: "needs-auth",
        nextAction: "Finalize Zendesk OAuth",
        updatedAt: "2025-10-15T17:12:00.000Z",
      },
      {
        id: "mission-governance",
        title: "Compliance Sweep",
        stage: "execute",
        owner: "Gabriela Ortiz",
        persona: "Governance",
        readiness: "needs-data",
        nextAction: "Upload evidence hashes",
        updatedAt: "2025-10-15T16:05:00.000Z",
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    missions: [],
  },
};
