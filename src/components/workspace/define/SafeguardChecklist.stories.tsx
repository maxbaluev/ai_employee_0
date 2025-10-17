import type { Meta, StoryObj } from "@storybook/react";

import { SafeguardChecklist } from "./SafeguardChecklist";

const safeguards = [
  {
    id: "sg-1",
    description: "Respect opt-out preferences and DNC lists",
    severity: "medium" as const,
    source: "generated" as const,
    completed: false,
  },
  {
    id: "sg-2",
    description: "Ensure legal review signs off on outreach copy",
    severity: "high" as const,
    source: "manual" as const,
    completed: true,
  },
];

const meta: Meta<typeof SafeguardChecklist> = {
  title: "Workspace/Define/SafeguardChecklist",
  component: SafeguardChecklist,
  args: {
    safeguards,
    onAdd: () => {},
    onRemove: () => {},
    onToggle: () => {},
    disabled: false,
  },
};

export default meta;

type Story = StoryObj<typeof SafeguardChecklist>;

export const Default: Story = {};

export const Locked: Story = {
  args: {
    disabled: true,
  },
};
