"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { emitTelemetry } from "@/lib/telemetry/client";

const FALLBACK_MISSION_ID = "00000000-0000-4000-8000-000000000000";
const FALLBACK_TENANT_ID = "tenant-demo";
const FALLBACK_USER_ID = "operator-demo";

export type PersonaKey = "revops" | "support" | "engineering" | "governance" | "general";

export type IntakeStatus = "idle" | "loading" | "ready" | "error";

export type MissionBrief = {
  objective: string;
  audience: string;
  kpi: string;
  timeline: string;
  summary: string;
};

export type SafeguardSeverity = "low" | "medium" | "high";

export type MissionSafeguard = {
  id: string;
  description: string;
  severity: SafeguardSeverity;
  source: "generated" | "manual";
  completed: boolean;
};

export type ConfidenceWithLevel = {
  score?: number;
  level: "high" | "medium" | "low";
};

export type IntakeMessage = {
  id: string;
  role: "assistant" | "system" | "user";
  text: string;
  timestamp: string;
};

export type MissionIntakeState = {
  intent: string;
  persona: PersonaKey;
  templateId: string | null;
  status: IntakeStatus;
  error: string | null;
  brief: MissionBrief;
  confidences: Record<string, number>;
  safeguards: MissionSafeguard[];
  locked: boolean;
  lastUpdated: string | null;
  messages: IntakeMessage[];
};

export type UseMissionIntakeOptions = {
  missionId?: string;
  tenantId?: string;
  userId?: string;
};

export const PERSONA_TEMPLATES: Record<Exclude<PersonaKey, "general">, string> = {
  revops:
    "Re-engage dormant manufacturing accounts with personalised outreach that highlights ROI wins.",
  support:
    "Stabilise the tier-1 support queue by triaging overdue tickets and flagging security issues.",
  engineering:
    "Coordinate a staggered production rollout with rollback steps and incident guardrails.",
  governance:
    "Assemble the Q4 compliance evidence pack with audit-ready artefacts and approval logs.",
};

const EMPTY_BRIEF: MissionBrief = {
  objective: "",
  audience: "",
  kpi: "",
  timeline: "",
  summary: "",
};

type AddSafeguardPayload = {
  description: string;
  severity: SafeguardSeverity;
};

type BackendResponse = {
  mission_brief: Record<string, string>;
  confidence_scores: Record<string, number>;
  safeguards: Array<{
    description?: string;
    severity?: string;
  }>;
  generation_latency_ms?: number;
};

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `mission-intake-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mapConfidence(score?: number): "high" | "medium" | "low" {
  if (typeof score !== "number") {
    return "low";
  }

  if (score >= 0.85) {
    return "high";
  }

  if (score >= 0.65) {
    return "medium";
  }

  return "low";
}

function resolveSupabaseToken(): string | null {
  if (typeof window === "undefined" || !("localStorage" in window)) {
    return null;
  }

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.includes("-auth-token")) {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed = JSON.parse(raw);
        if (parsed?.access_token) {
          return parsed.access_token as string;
        }
      }
    }
  } catch (error) {
    // Ignore parsing errors – fall back to unauthenticated request.
  }

  return null;
}

export function useMissionIntake(options?: UseMissionIntakeOptions) {
  const missionIdRef = useRef(options?.missionId ?? FALLBACK_MISSION_ID);
  const tenantIdRef = useRef(options?.tenantId ?? FALLBACK_TENANT_ID);
  const userIdRef = useRef(options?.userId ?? FALLBACK_USER_ID);

  const [intent, setIntent] = useState("");
  const [persona, setPersona] = useState<PersonaKey>("general");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [status, setStatus] = useState<IntakeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<MissionBrief>(EMPTY_BRIEF);
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [safeguards, setSafeguards] = useState<MissionSafeguard[]>([]);
  const [locked, setLocked] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [messages, setMessages] = useState<IntakeMessage[]>([
    {
      id: generateId(),
      role: "assistant",
      text: "Share the mission intent and I will assemble a structured brief with safeguards.",
      timestamp: new Date().toISOString(),
    },
  ]);

  const missionId = missionIdRef.current;
  const tenantId = tenantIdRef.current;
  const userId = userIdRef.current;

  const hasBrief = useMemo(
    () => Object.values(brief).some((value) => value.trim().length > 0),
    [brief],
  );

  const resetGenerationError = useCallback(() => {
    setError(null);
  }, []);

  const appendMessage = useCallback((message: Omit<IntakeMessage, "id" | "timestamp">) => {
    setMessages((previous) => [
      ...previous,
      {
        id: generateId(),
        timestamp: new Date().toISOString(),
        ...message,
      },
    ]);
  }, []);

  const updateChip = useCallback(
    (field: keyof MissionBrief, value: string, emitEvent = true) => {
      setBrief((previous) => {
        if (previous[field] === value) {
          return previous;
        }

        if (emitEvent) {
          emitTelemetry("brief_item_modified", {
            mission_id: missionId,
            tenant_id: tenantId,
            user_id: userId,
            chip_type: field,
            edit_type: "manual",
            token_diff: value.split(/\s+/).length - previous[field].split(/\s+/).length,
          });
        }

        return {
          ...previous,
          [field]: value,
        };
      });
    },
    [missionId, tenantId, userId],
  );

  const addSafeguard = useCallback(
    ({ description, severity }: AddSafeguardPayload) => {
      if (!description.trim()) {
        return;
      }

      const safeguard: MissionSafeguard = {
        id: generateId(),
        description: description.trim(),
        severity,
        source: "manual",
        completed: false,
      };

      setSafeguards((previous) => [...previous, safeguard]);
      emitTelemetry("safeguard_added", {
        mission_id: missionId,
        tenant_id: tenantId,
        user_id: userId,
        category: "manual",
        description: safeguard.description,
        severity,
      });
    },
    [missionId, tenantId, userId],
  );

  const removeSafeguard = useCallback((id: string) => {
    setSafeguards((previous) => previous.filter((item) => item.id !== id));
  }, []);

  const toggleSafeguard = useCallback((id: string) => {
    setSafeguards((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              completed: !item.completed,
            }
          : item,
      ),
    );
  }, []);

  const lockBrief = useCallback(() => {
    if (!hasBrief) {
      return;
    }

    setLocked(true);
    appendMessage({
      role: "assistant",
      text: "Mission brief locked. You can proceed to the Prepare stage when ready.",
    });

    emitTelemetry("mission_brief_locked", {
      mission_id: missionId,
      tenant_id: tenantId,
      user_id: userId,
      safeguard_count: safeguards.length,
      has_objective: Boolean(brief.objective.trim()),
    });
  }, [appendMessage, brief.objective, hasBrief, missionId, tenantId, userId, safeguards.length]);

  const selectPersonaTemplate = useCallback((nextPersona: PersonaKey) => {
    setPersona(nextPersona);
    if (nextPersona === "general") {
      setTemplateId(null);
      return;
    }

    setTemplateId(`template-${nextPersona}`);
    const template = PERSONA_TEMPLATES[nextPersona];
    setIntent(template);
  }, []);

  const generateBrief = useCallback(async () => {
    if (!intent.trim()) {
      setError("Enter a mission intent before generating a brief.");
      return;
    }

    setStatus("loading");
    setError(null);
    appendMessage({ role: "assistant", text: "Parsing intent and assembling mission brief…" });

    emitTelemetry("intent_submitted", {
      mission_id: missionId,
      tenant_id: tenantId,
      user_id: userId,
      persona,
      intent_length: intent.trim().length,
      template_id: templateId,
    });

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const token = resolveSupabaseToken();
      if (token) {
        headers.authorization = `Bearer ${token}`;
      }

      const response = await fetch("/api/intake/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          missionId,
          persona,
          intent: intent.trim(),
          templateId,
          hints: brief,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          typeof errorBody.message === "string"
            ? errorBody.message
            : "Failed to generate mission brief. Try again shortly.",
        );
      }

      const payload = (await response.json()) as BackendResponse;

      const nextBrief: MissionBrief = {
        objective: payload.mission_brief.objective ?? brief.objective,
        audience: payload.mission_brief.audience ?? brief.audience,
        kpi: payload.mission_brief.kpi ?? brief.kpi,
        timeline: payload.mission_brief.timeline ?? brief.timeline,
        summary: payload.mission_brief.summary ?? brief.summary,
      };

      setBrief(nextBrief);
      setConfidences(payload.confidence_scores ?? {});
      setSafeguards(() =>
        (payload.safeguards ?? [])
          .filter((item) => Boolean(item.description))
          .map((item) => ({
            id: generateId(),
            description: item.description ?? "",
            severity:
              item.severity === "high" || item.severity === "low"
                ? (item.severity as SafeguardSeverity)
                : "medium",
            source: "generated" as const,
            completed: false,
          })),
      );

      const latency = payload.generation_latency_ms ?? 0;

      setStatus("ready");
      setLastUpdated(new Date().toISOString());
      appendMessage({
        role: "assistant",
        text: `Brief ready${latency ? ` in ${Math.round(latency)}ms` : ""}. Review the chips before locking.`,
      });

      emitTelemetry("brief_generated", {
        mission_id: missionId,
        tenant_id: tenantId,
        user_id: userId,
        persona,
        chip_count: Object.values(nextBrief).filter((value) => value.trim()).length,
        confidence_scores: payload.confidence_scores,
        generation_latency_ms: latency,
      });
    } catch (generationError) {
      setStatus("error");
      const message =
        generationError instanceof Error
          ? generationError.message
          : "Unexpected error while generating the mission brief.";
      setError(message);
      appendMessage({ role: "assistant", text: message });
    }
  }, [appendMessage, brief, intent, missionId, persona, templateId, tenantId, userId]);

  const confidencesWithLevel = useMemo<Record<string, ConfidenceWithLevel>>(() => {
    return Object.fromEntries(
      Object.entries(confidences).map(([key, score]) => [key, { score, level: mapConfidence(score) }]),
    );
  }, [confidences]);

  return {
    state: {
      intent,
      persona,
      templateId,
      status,
      error,
      brief,
      confidences,
      safeguards,
      locked,
      lastUpdated,
      messages,
    } as MissionIntakeState,
    setIntent,
    setPersona,
    setTemplateId,
    resetGenerationError,
    updateChip,
    addSafeguard,
    removeSafeguard,
    toggleSafeguard,
    generateBrief,
    lockBrief,
    selectPersonaTemplate,
    confidencesWithLevel,
    hasBrief,
  };
}

export type UseMissionIntakeReturn = ReturnType<typeof useMissionIntake>;
