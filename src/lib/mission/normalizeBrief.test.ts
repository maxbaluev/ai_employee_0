/// <reference types="vitest" />

import { describe, expect, it } from "vitest";

import {
  normalizeMissionBrief,
  type MissionMetadataRowLike,
  type MissionSafeguardRowLike,
} from "./normalizeBrief";

const baseMetadata = (overrides: Partial<MissionMetadataRowLike> = {}): MissionMetadataRowLike => ({
  field: "objective",
  value: { text: "Launch new product" },
  confidence: 0.92,
  ...overrides,
});

const baseSafeguard = (
  overrides: Partial<MissionSafeguardRowLike> = {},
): MissionSafeguardRowLike => ({
  hint_type: "tone",
  suggested_value: { text: "Maintain professional tone" },
  status: "accepted",
  ...overrides,
});

describe("normalizeMissionBrief", () => {
  it("normalizes objective, audience, kpis, safeguards, and confidence", () => {
    const metadata: MissionMetadataRowLike[] = [
      baseMetadata({ field: "objective", value: { text: "Improve retention" }, confidence: 0.8 }),
      baseMetadata({ field: "audience", value: { text: "Enterprise admins" }, confidence: 0.7 }),
      baseMetadata({
        field: "kpis",
        value: {
          items: [
            { label: "NPS", target: "+10" },
            { label: "Churn", target: "-3%" },
          ],
        },
        confidence: 0.6,
      }),
    ];

    const safeguards: MissionSafeguardRowLike[] = [
      baseSafeguard({ hint_type: "safety", suggested_value: { text: "Avoid PII" } }),
    ];

    const result = normalizeMissionBrief(metadata, safeguards);

    expect(result.objective).toBe("Improve retention");
    expect(result.audience).toBe("Enterprise admins");
    expect(result.kpis).toEqual([
      { label: "NPS", target: "+10" },
      { label: "Churn", target: "-3%" },
    ]);
    expect(result.safeguards).toEqual([
      { hintType: "safety", text: "Avoid PII" },
    ]);
    expect(result.confidence).toEqual({
      objective: 0.8,
      audience: 0.7,
      kpis: 0.6,
    });
  });

  it("handles missing metadata gracefully", () => {
    const result = normalizeMissionBrief([], []);

    expect(result).toEqual({
      objective: "",
      audience: "",
      kpis: [],
      safeguards: [],
      confidence: {},
    });
  });

  it("filters safeguards without text", () => {
    const safeguards: MissionSafeguardRowLike[] = [
      baseSafeguard({ suggested_value: { text: "Pin urgent items" } }),
      baseSafeguard({ hint_type: "risk", suggested_value: {}, status: "accepted" }),
      baseSafeguard({ hint_type: "manual", suggested_value: { text: "" } }),
    ];

    const result = normalizeMissionBrief([], safeguards);

    expect(result.safeguards).toEqual([
      { hintType: "tone", text: "Pin urgent items" },
    ]);
  });

  it("ignores safeguards that are not accepted", () => {
    const safeguards: MissionSafeguardRowLike[] = [
      baseSafeguard({ suggested_value: { text: "Keep audit trail" }, status: "accepted" }),
      baseSafeguard({ suggested_value: { text: "Draft hint" }, status: "suggested" }),
    ];

    const result = normalizeMissionBrief([], safeguards);

    expect(result.safeguards).toEqual([
      { hintType: "tone", text: "Keep audit trail" },
    ]);
  });

  it("supports KPI arrays without items wrapper", () => {
    const metadata: MissionMetadataRowLike[] = [
      baseMetadata({
        field: "kpis",
        value: [
          { label: "Activation", target: "90%" },
          { label: "Tickets", target: "< 5" },
        ],
      }),
    ];

    const result = normalizeMissionBrief(metadata, []);

    expect(result.kpis).toEqual([
      { label: "Activation", target: "90%" },
      { label: "Tickets", target: "< 5" },
    ]);
  });

  it("stores null confidence values when missing", () => {
    const metadata: MissionMetadataRowLike[] = [
      baseMetadata({ field: "objective", value: { text: "Expand to LATAM" }, confidence: null }),
    ];

    const result = normalizeMissionBrief(metadata, []);

    expect(result.confidence).toEqual({ objective: null });
  });

  it("accepts string objectives/audience directly", () => {
    const metadata: MissionMetadataRowLike[] = [
      baseMetadata({ field: "objective", value: "Grow pipeline" }),
      baseMetadata({ field: "audience", value: "GTMS" }),
    ];

    const result = normalizeMissionBrief(metadata, []);

    expect(result.objective).toBe("Grow pipeline");
    expect(result.audience).toBe("GTMS");
  });
});

