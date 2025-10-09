import {
  CopilotRuntime,
  GoogleGenerativeAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { HttpAgent } from "@ag-ui/client";
import { NextRequest } from "next/server";

// Configure Next.js route for streaming responses
// This is required for CopilotKit's SSE streaming to work properly
export const maxDuration = 60;

const agentId =
  process.env.NEXT_PUBLIC_COPILOT_AGENT_ID ?? "control_plane_foundation";
const agentUrl = process.env.AGENT_HTTP_URL ?? "http://localhost:8000/";

// Use GoogleGenerativeAIAdapter for proper request handling with Google API
// This uses GOOGLE_API_KEY from environment and provides correct JSON body parsing
const serviceAdapter = new GoogleGenerativeAIAdapter({
  model: "gemini-2.5-flash",
});

// Initialize the runtime with the HttpAgent
const httpAgent = new HttpAgent({ url: agentUrl });
const runtime = new CopilotRuntime({
  agents: {
    [agentId]: httpAgent as any, // Type assertion needed for dynamic key
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
