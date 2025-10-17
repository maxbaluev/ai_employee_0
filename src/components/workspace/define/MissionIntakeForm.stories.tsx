import type { Meta, StoryObj } from "@storybook/react";

import { MissionIntakeForm } from "./MissionIntakeForm";

const meta: Meta<typeof MissionIntakeForm> = {
  title: "Workspace/Define/MissionIntakeForm",
  component: MissionIntakeForm,
  parameters: {
    layout: "centered",
  },
  args: {
    intent: "Re-engage dormant manufacturing accounts with personalised outreach",
    status: "idle",
    error: null,
    lastUpdated: null,
    onIntentChange: () => {},
    onSubmit: () => {},
    onDismissError: () => {},
  },
};

export default meta;

type Story = StoryObj<typeof MissionIntakeForm>;

export const Idle: Story = {};

export const Loading: Story = {
  args: {
    status: "loading",
  },
};

export const Ready: Story = {
  args: {
    status: "ready",
    lastUpdated: new Date().toISOString(),
  },
};

export const ErrorState: Story = {
  args: {
    status: "error",
    error: "Unable to reach intake service. Try again in a moment.",
  },
};
