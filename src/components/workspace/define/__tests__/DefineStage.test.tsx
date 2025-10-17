import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DefineStage from "@/app/(control-plane)/workspace/define/page";

const emitTelemetry = vi.fn();

vi.mock("@/lib/telemetry/client", () => ({
  emitTelemetry: (...args: unknown[]) => emitTelemetry(...args),
}));

const mockResponsePayload = {
  mission_brief: {
    objective: "Re-engage dormant accounts with an empathetic win-back sequence",
    audience: "Dormant revenue accounts",
    kpi: "≥3% reply rate",
    timeline: "3 business days",
    summary: "Consultative win-back sprint for high-potential accounts",
  },
  confidence_scores: {
    objective: 0.9,
    audience: 0.7,
    kpi: 0.65,
    timeline: 0.6,
    summary: 0.7,
  },
  safeguards: [
    {
      description: "Respect opt-out preferences and DNC lists",
      severity: "medium",
    },
  ],
  generation_latency_ms: 420,
};

describe("DefineStage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(mockResponsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const originalCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      ...originalCrypto,
      randomUUID: () => `test-uuid-${Math.random().toString(16).slice(2)}`,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("generates mission chips and allows inline editing", async () => {
    render(<DefineStage />);

    const intentField = screen.getByRole("textbox", { name: /mission intent/i });
    await userEvent.type(intentField, "Re-engage dormant accounts with trusted outreach");

    const generateButton = screen.getByRole("button", { name: /generate brief/i });
    await userEvent.click(generateButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/intake/generate",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await screen.findByText(/Dormant revenue accounts/);

    const editObjective = screen.getByRole("button", { name: /edit objective chip/i });
    await userEvent.click(editObjective);

    const objectiveField = screen.getByRole("textbox", { name: /objective value/i });
    await userEvent.clear(objectiveField);
    await userEvent.type(objectiveField, "Align outreach with customer success playbooks");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(
      screen.getByText(/Align outreach with customer success playbooks/),
    ).toBeInTheDocument();
    expect(emitTelemetry).toHaveBeenCalledWith(
      "brief_item_modified",
      expect.objectContaining({ chip_type: "objective" }),
    );
  });

  it("adds safeguards and locks the mission brief", async () => {
    render(<DefineStage />);

    const intentField = screen.getByRole("textbox", { name: /mission intent/i });
    await userEvent.type(intentField, "Coordinate compliance evidence for Q4 audit");
    await userEvent.click(screen.getByRole("button", { name: /generate brief/i }));

    await screen.findByText(/Respect opt-out preferences/);

    const safeguardInput = screen.getByPlaceholderText(/Document the guardrail/i);
    await userEvent.type(safeguardInput, "Ensure legal review signs off on outreach copy");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /severity/i }), "high");
    await userEvent.click(screen.getByRole("button", { name: /add safeguard/i }));

    expect(
      screen.getByText(/Ensure legal review signs off on outreach copy/),
    ).toBeInTheDocument();
    expect(emitTelemetry).toHaveBeenCalledWith(
      "safeguard_added",
      expect.objectContaining({ description: expect.stringContaining("legal review") }),
    );

    await userEvent.click(screen.getByRole("button", { name: /lock brief/i }));

    const confirmButton = await screen.findByRole("button", { name: /confirm lock/i });
    await userEvent.click(confirmButton);

    expect(emitTelemetry).toHaveBeenCalledWith(
      "mission_brief_locked",
      expect.objectContaining({ safeguard_count: expect.any(Number) }),
    );
    expect(screen.getByRole("button", { name: /brief locked/i })).toBeDisabled();
  });
});
