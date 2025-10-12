import type { Metadata } from "next";

import { CopilotKit } from "@copilotkit/react-core";
import "./globals.css";
import "@copilotkit/react-ui/styles.css";

const runtimeUrl = process.env.NEXT_PUBLIC_COPILOT_RUNTIME_URL ?? "/api/copilotkit";
const agentId = process.env.NEXT_PUBLIC_COPILOT_AGENT_ID ?? "control_plane_foundation";

export const metadata: Metadata = {
  title: "AI Employee Control Plane — Gate G-B",
  description: "Mission workspace for Gate G-B dry-run proofs and guardrail rehearsal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={"antialiased"}>
        <CopilotKit runtimeUrl={runtimeUrl} agent={agentId}>
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}
