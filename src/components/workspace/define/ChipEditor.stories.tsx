import type { Meta, StoryObj } from "@storybook/react";

import { ChipEditor } from "./ChipEditor";

const sampleBrief = {
  objective: "Re-engage dormant manufacturing accounts with empathetic outreach",
  audience: "Dormant revenue accounts",
  kpi: "≥3% reply rate",
  timeline: "3 business days",
  summary: "Consultative win-back sprint for high-potential accounts",
};

const confidences = {
  objective: { score: 0.92, level: "high" as const },
  audience: { score: 0.7, level: "medium" as const },
  kpi: { score: 0.66, level: "medium" as const },
  timeline: { score: 0.55, level: "low" as const },
  summary: { score: 0.88, level: "high" as const },
};

const meta: Meta<typeof ChipEditor> = {
  title: "Workspace/Define/ChipEditor",
  component: ChipEditor,
  args: {
    brief: sampleBrief,
    confidences,
    status: "ready",
    locked: false,
    onChipUpdate: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof ChipEditor>;

export const Ready: Story = {};

export const Loading: Story = {
  args: {
    status: "loading",
  },
};

export const Locked: Story = {
  args: {
    locked: true,
  },
};
