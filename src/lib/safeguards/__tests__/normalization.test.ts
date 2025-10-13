/// <reference types="vitest" />

import { describe, expect, it } from "vitest";

import {
  buildSafeguardId,
  hashSafeguardText,
  normalizeSafeguards,
} from "@/lib/safeguards/normalization";

describe("safeguard normalization helpers", () => {
  it("hashes safeguard text deterministically", () => {
    expect(hashSafeguardText("keep it safe")).toBe(hashSafeguardText("keep it safe"));
    expect(hashSafeguardText("a" + "b")).not.toBe(hashSafeguardText("b" + "a"));
  });

  it("builds IDs that include hint type and occurrence", () => {
    const first = buildSafeguardId({ hintType: "tone", text: "Use a calm voice" }, 0);
    const second = buildSafeguardId({ hintType: "tone", text: "Use a calm voice" }, 1);

    expect(first).toMatch(/^tone-/);
    expect(second).toMatch(/^tone-/);
    expect(first).not.toEqual(second);
  });

  it("reuses previously normalised safeguard state", () => {
    const rawHints = [
      { hintType: "tone", text: "Keep responses calm" },
      { hintType: "escalation", text: "Loop in a human reviewer" },
    ];

    const firstPass = normalizeSafeguards(rawHints, [], ({ id, hint }) => ({
      id,
      label: hint.text,
      hintType: hint.hintType ?? "unspecified",
      status: "accepted" as const,
      confidence: null,
      pinned: false,
      rationale: null,
      lastUpdatedAt: null,
    }));

    const edited = {
      ...firstPass[0],
      label: "Keep responses neutral",
      status: "edited" as const,
    };

    const secondPass = normalizeSafeguards(rawHints, [edited, firstPass[1]], ({ id, hint }) => ({
      id,
      label: hint.text,
      hintType: hint.hintType ?? "unspecified",
      status: "accepted" as const,
      confidence: null,
      pinned: false,
      rationale: null,
      lastUpdatedAt: null,
    }));

    expect(secondPass[0]).toEqual(edited);
    expect(secondPass[1]).toEqual(firstPass[1]);
  });
});
