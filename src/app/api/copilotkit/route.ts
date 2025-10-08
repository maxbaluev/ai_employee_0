import {
  CopilotRuntime,
  ExperimentalEmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";

const serviceAdapter = new ExperimentalEmptyAdapter();
const agentId = process.env.NEXT_PUBLIC_COPILOT_AGENT_ID ?? "control_plane_foundation";
const agentUrl = process.env.AGENT_HTTP_URL ?? "http://localhost:8000/";

const runtime = new CopilotRuntime({
  agents: {
    [agentId]: new HttpAgent({ url: agentUrl }),
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });

  return handleRequest(req);
};
