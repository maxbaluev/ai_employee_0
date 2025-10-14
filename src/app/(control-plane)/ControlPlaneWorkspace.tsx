"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar, type CopilotKitCSSProperties } from "@copilotkit/react-ui";

import { ApprovalModal } from "@/components/ApprovalModal";
import { CoverageMeter } from "@/components/CoverageMeter";
import { ArtifactGallery, type ArtifactGalleryArtifact } from "@/components/ArtifactGallery";
import { ArtifactUndoBar } from "@/components/ArtifactUndoBar";
import type { UndoPlanMetadata } from "@/components/StreamingStatusPanel";
import { FeedbackDrawer } from "@/components/FeedbackDrawer";
import { MissionIntake } from "@/components/MissionIntake";
import { MissionBriefCard } from "@/components/MissionBriefCard";
import { RecommendedToolStrip } from "@/components/RecommendedToolStrip";
import {
  SafeguardDrawer,
  type SafeguardDrawerHint,
  type SafeguardDrawerHistoryItem,
} from "@/components/SafeguardDrawer";
import { StreamingStatusPanel } from "@/components/StreamingStatusPanel";
import {
  MissionStageProvider,
  MissionStageProgress,
  MissionStage,
  useMissionStages,
} from "@/components/mission-stages";
import type { MissionStageState, MissionStageStatus } from "@/components/mission-stages";
import type { TimelineMessage } from "@/hooks/useTimelineEvents";
import { useApprovalFlow } from "@/hooks/useApprovalFlow";
import type { ApprovalSubmission, SafeguardEntry } from "@/hooks/useApprovalFlow";
import { useUndoFlow } from "@/hooks/useUndoFlow";
import { clearUndoBanner, loadUndoBanner, saveUndoBanner } from "@/lib/undo/sessionStorage";
import { PlannerInsightRail } from "@/components/PlannerInsightRail";
import * as telemetryClient from "@/lib/telemetry/client";
import { normalizeSafeguards } from "@/lib/safeguards/normalization";

type Artifact = ArtifactGalleryArtifact;

type UndoBannerState = {
  toolCallId: string;
  summary: string | null;
  riskTags: string[];
  expiresAt: number;
  undoToken: string | null;
  overrideAllowed: boolean;
  overrideUrl: string | null;
};

type CatalogSummary = {
  total_entries: number;
  toolkits: number;
  categories: string[];
};

type MissionBriefState = {
  missionId: string;
  objective: string;
  audience: string;
  kpis: Array<{ label: string; target?: string | null }>;
  safeguards: Array<{ hintType: string | null; text: string }>;
  confidence?: Record<string, number | null>;
  source?: string | null;
};

type ControlPlaneWorkspaceProps = {
  tenantId: string;
  initialObjectiveId?: string | null;
  initialArtifacts: Artifact[];
  catalogSummary?: CatalogSummary;
};

type HydratedMissionStage = {
  stage: MissionStage;
  state: MissionStageState;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  locked?: boolean;
  metadata?: Record<string, unknown>;
};

type PlannerRunSnapshot = {
  id: string;
  stage: string | null;
  event?: string | null;
  createdAt: string;
  label?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
};

type CopilotSessionSnapshot = {
  artifacts?: Artifact[];
  objectiveId?: string | null;
  missionStages?: HydratedMissionStage[];
  missionBrief?: MissionBriefState | null;
  safeguards?: SafeguardDrawerHint[];
  safeguardHistory?: SafeguardDrawerHistoryItem[];
  selectedFeedbackRating?: number | null;
  themeColor?: string;
  plannerRuns?: PlannerRunSnapshot[];
};

type AcceptedIntakePayload = {
  missionId: string;
  objective?: string;
  audience?: string;
  guardrailSummary?: string;
  kpis?: Array<{ label: string; target?: string }>;
  confidence?: number;
};

const AGENT_ID = "control_plane_foundation";
const SESSION_RETENTION_MINUTES = 60 * 24 * 7; // 7 days
const MAX_SAFEGUARD_HISTORY = 20;
const DEFAULT_UNDO_WINDOW_SECONDS = 15 * 60;

function ControlPlaneWorkspaceContent({
  tenantId,
  initialObjectiveId,
  initialArtifacts,
  catalogSummary,
}: ControlPlaneWorkspaceProps) {
  const {
    currentStage,
    stages,
    markStageCompleted,
    markStageStarted,
    hydrateStages,
  } = useMissionStages();
  const [themeColor, setThemeColor] = useState("#4f46e5");
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialArtifacts);
  const [objectiveId, setObjectiveId] = useState<string | undefined | null>(initialObjectiveId);
  const [isSidebarReady, setIsSidebarReady] = useState(false);
  const [workspaceAlert, setWorkspaceAlert] = useState<
    { tone: "success" | "error" | "info" | "warning"; message: string } | null
  >(null);
  const [selectedToolkitsCount, setSelectedToolkitsCount] = useState(0);
  const [isFeedbackDrawerOpen, setFeedbackDrawerOpen] = useState(false);
  const [selectedFeedbackRating, setSelectedFeedbackRating] = useState<number | null>(null);
  const [missionBrief, setMissionBrief] = useState<MissionBriefState | null>(null);
  const [undoBanner, setUndoBanner] = useState<UndoBannerState | null>(null);
  const [safeguards, setSafeguards] = useState<SafeguardDrawerHint[]>([]);
  const [safeguardHistory, setSafeguardHistory] = useState<SafeguardDrawerHistoryItem[]>([]);
  const [, setSafeguardHistoryOpen] = useState(false);
  const [approvalUndoSummary, setApprovalUndoSummary] = useState<string | undefined>(undefined);
  const [plannerRuns, setPlannerRuns] = useState<PlannerRunSnapshot[]>([]);
  const hasPinnedBriefRef = useRef(false);
  const copilotExitHandledRef = useRef(false);
  const lastHydratedSessionRef = useRef<string | null>(null);
  const sessionTelemetrySentRef = useRef(false);
  const missionId = objectiveId ?? initialObjectiveId ?? null;
  const latestExitPayloadRef = useRef({
    tenantId,
    missionId,
    artifactsCount: artifacts.length,
    stage: currentStage,
  });

  latestExitPayloadRef.current.missionId = missionId;
  const hydrationCompleteRef = useRef(false);
  const [hydrationComplete, setHydrationComplete] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      return;
    }
    const storedBanner = loadUndoBanner(tenantId, missionId);
    if (storedBanner) {
      setUndoBanner(storedBanner);
    } else {
      setUndoBanner((current) => {
        if (current && current.expiresAt <= Date.now()) {
          return null;
        }
        return current;
      });
    }
  }, [tenantId, missionId]);

  const acceptedSafeguardEntries = useMemo<SafeguardEntry[]>(
    () =>
      safeguards
        .filter((entry) => entry.status === "accepted")
        .map((entry) => ({
          type: entry.hintType ?? "safeguard",
          value: entry.label,
          confidence: typeof entry.confidence === "number" ? entry.confidence : undefined,
          pinned: entry.pinned ?? false,
        })),
    [safeguards],
  );

  const safeguardChips = useMemo(
    () =>
      acceptedSafeguardEntries.map((entry) => ({
        type: entry.type,
        value: entry.value,
        confidence: entry.confidence,
        status: "accepted",
      })),
    [acceptedSafeguardEntries],
  );

  const clearUndoBannerState = useCallback(
    (reason: "expired" | "completed" | "dismissed") => {
      let removed = false;
      setUndoBanner((current) => {
        if (!current) {
          return current;
        }
        removed = true;
        void telemetryClient.sendTelemetryEvent(tenantId, {
          eventName: "undo_banner_dismissed",
          missionId: missionId ?? undefined,
          eventData: {
            tool_call_id: current.toolCallId,
            reason,
          },
        });
        return null;
      });
      if (removed) {
        clearUndoBanner(tenantId, missionId);
      }
    },
    [missionId, tenantId],
  );

  const handleUndoBannerExpired = useCallback(() => {
    clearUndoBannerState("expired");
  }, [clearUndoBannerState]);

  const handleUndoPlanDetected = useCallback(
    (plan: UndoPlanMetadata | null) => {
      if (!plan) {
        return;
      }

      const windowSeconds =
        typeof plan.undoWindowSeconds === "number" && plan.undoWindowSeconds > 0
          ? plan.undoWindowSeconds
          : DEFAULT_UNDO_WINDOW_SECONDS;

      const issuedTimestamp = Number.isFinite(Date.parse(plan.issuedAt))
        ? Date.parse(plan.issuedAt)
        : Date.now();
      const expiresAt = issuedTimestamp + Math.max(windowSeconds, 0) * 1000;

      if (expiresAt <= Date.now()) {
        clearUndoBanner(tenantId, missionId);
        setUndoBanner(null);
        return;
      }

      const matchingArtifact = artifacts.find(
        (artifact) => artifact.artifact_id === plan.toolCallId,
      );
      const undoToken = plan.undoToken ?? matchingArtifact?.undo_token ?? null;

      if (
        undoBanner &&
        undoBanner.toolCallId === plan.toolCallId &&
        undoBanner.expiresAt === expiresAt &&
        undoBanner.undoToken === undoToken
      ) {
        return;
      }

      const nextBanner: UndoBannerState = {
        toolCallId: plan.toolCallId,
        summary: plan.undoSummary,
        riskTags: plan.riskTags,
        expiresAt,
        undoToken,
        overrideAllowed: plan.overrideAllowed,
        overrideUrl: plan.overrideUrl,
      };

      setUndoBanner(nextBanner);
      saveUndoBanner(tenantId, missionId, nextBanner);
      void telemetryClient.sendTelemetryEvent(tenantId, {
        eventName: "undo_banner_shown",
        missionId: missionId ?? undefined,
        eventData: {
          tool_call_id: plan.toolCallId,
          expires_at: new Date(expiresAt).toISOString(),
          undo_window_seconds: windowSeconds,
          override_allowed: plan.overrideAllowed,
          risk_tags: plan.riskTags,
        },
      });
    },
    [artifacts, missionId, tenantId, undoBanner],
  );

  useEffect(() => {
    if (!undoBanner || undoBanner.undoToken) {
      return;
    }
    const matching = artifacts.find((artifact) => artifact.artifact_id === undoBanner.toolCallId);
    if (matching?.undo_token && matching.undo_token !== undoBanner.undoToken) {
      const updated: UndoBannerState = {
        ...undoBanner,
        undoToken: matching.undo_token,
      };
      setUndoBanner(updated);
      saveUndoBanner(tenantId, missionId, updated);
    }
  }, [artifacts, missionId, tenantId, undoBanner]);

  const feedbackStageStatus = stages.get(MissionStage.Feedback);
  const canDisplayFeedbackDrawer =
    currentStage === MissionStage.Evidence ||
    feedbackStageStatus?.state === "active" ||
    feedbackStageStatus?.state === "completed";

  useEffect(() => {
    if (!objectiveId) {
      setSelectedToolkitsCount(0);
      setMissionBrief(null);
      setSafeguards([]);
      setSafeguardHistory([]);
      setSafeguardHistoryOpen(false);
      setPlannerRuns([]);
      hasPinnedBriefRef.current = false;
    }
  }, [objectiveId]);

  useEffect(() => {
    if (!objectiveId) {
      return;
    }

    if (missionBrief?.missionId === objectiveId) {
      return;
    }

    let cancelled = false;
    hasPinnedBriefRef.current = false;

    const fetchBrief = async () => {
      try {
        const query = new URLSearchParams({ tenantId }).toString();
        const response = await fetch(`/api/missions/${objectiveId}/brief?${query}`);
        if (!response.ok) {
          throw new Error(`Failed to load mission brief (${response.status})`);
        }

        const payload = (await response.json()) as {
          brief: {
            objective: string;
            audience: string;
            kpis: Array<{ label: string; target?: string | null }>;
            safeguards: Array<{ hintType: string | null; text: string }>;
            confidence?: Record<string, number | null>;
          } | null;
        };

        if (cancelled || !payload.brief) {
          return;
        }

        const normalizedBrief: MissionBriefState = {
          missionId: objectiveId,
          objective: payload.brief.objective,
          audience: payload.brief.audience,
          kpis: payload.brief.kpis ?? [],
          safeguards: payload.brief.safeguards ?? [],
          confidence: payload.brief.confidence,
          source: null,
        };

        setMissionBrief(normalizedBrief);
        setSafeguards((prev) => normalizeSafeguards(normalizedBrief.safeguards, prev));
        setSafeguardHistory([]);
        setSafeguardHistoryOpen(false);

        void telemetryClient.sendTelemetryEvent(tenantId, {
          eventName: "mission_brief_loaded",
          missionId: objectiveId,
          eventData: {
            kpi_count: normalizedBrief.kpis.length,
            safeguard_count: normalizedBrief.safeguards.length,
          },
        });
      } catch (error) {
        console.error("Failed to load mission brief", error);
      }
    };

    void fetchBrief();

    return () => {
      cancelled = true;
    };
  }, [missionBrief?.missionId, objectiveId, tenantId]);

  useEffect(() => {
    if (!missionBrief || !objectiveId) {
      return;
    }

    if (missionBrief.missionId !== objectiveId) {
      return;
    }

    if (hasPinnedBriefRef.current) {
      return;
    }

    hasPinnedBriefRef.current = true;

    void telemetryClient.sendTelemetryEvent(tenantId, {
      eventName: "mission_brief_pinned",
      missionId,
      eventData: {
        kpi_count: missionBrief.kpis.length,
        safeguard_count: missionBrief.safeguards.length,
      },
    });
  }, [missionBrief, objectiveId, tenantId, missionId]);

  const sessionIdentifierRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mission-${Date.now()}`,
  );
  const sessionIdentifier = sessionIdentifierRef.current;

  const readableState = useMemo(
    () => ({
      artifacts,
      objectiveId: missionId,
    }),
    [artifacts, missionId],
  );

  useCopilotReadable({
    description: "Evidence artifacts tracked in the Gate G-B dry-run workspace",
    value: readableState,
  });

  const approvalFlow = useApprovalFlow({
    tenantId,
    missionId,
    onSuccess: ({ decision }) => {
      const label = decision.replace(/_/g, " ");
      setWorkspaceAlert({
        tone: "success",
        message: `Reviewer decision recorded (${label}).`,
      });
    },
  });

  const appendSafeguardHistory = useCallback(
    (entries: SafeguardDrawerHistoryItem[]) => {
      if (!entries.length) {
        return;
      }
      setSafeguardHistory((prev) => [...entries, ...prev].slice(0, MAX_SAFEGUARD_HISTORY));
    },
    [],
  );

  const restoreMissionStages = useCallback(
    (snapshot: HydratedMissionStage[] | undefined | null) => {
      if (!Array.isArray(snapshot) || snapshot.length === 0) {
        return;
      }

      hydrateStages(
        snapshot.map((entry) => ({
          stage: entry.stage as MissionStage,
          state: entry.state as MissionStageStatus['state'],
          startedAt: entry.startedAt ?? null,
          completedAt: entry.completedAt ?? null,
          metadata: entry.metadata ?? undefined,
          locked: entry.locked,
        })),
      );
    },
    [hydrateStages],
  );

  useEffect(() => {
    copilotExitHandledRef.current = false;
    lastHydratedSessionRef.current = null;
    sessionTelemetrySentRef.current = false;
    hydrationCompleteRef.current = false;
    setHydrationComplete(false);
  }, [sessionIdentifier]);

  useEffect(() => {
    latestExitPayloadRef.current = {
      tenantId,
      missionId,
      artifactsCount: artifacts.length,
      stage: currentStage,
    };
  }, [tenantId, missionId, artifacts.length, currentStage]);

  const missionStageSnapshot = useMemo(() => {
    const normalizeDate = (value: Date | string | null | undefined) => {
      if (!value) {
        return null;
      }
      if (typeof value === "string") {
        return value;
      }
      try {
        return value.toISOString();
      } catch (error) {
        console.warn("[ControlPlaneWorkspace] failed to serialise stage timestamp", error);
        return null;
      }
    };

    const snapshot: HydratedMissionStage[] = [];
    stages.forEach((status, stage) => {
      snapshot.push({
        stage,
        state: status.state,
        startedAt: normalizeDate(status.startedAt),
        completedAt: normalizeDate(status.completedAt),
        locked: status.locked,
        metadata: status.metadata,
      });
    });
    return snapshot;
  }, [stages]);

  const markHydrationComplete = useCallback(() => {
    if (hydrationCompleteRef.current) {
      return;
    }

    hydrationCompleteRef.current = true;
    setHydrationComplete(true);
  }, [setHydrationComplete]);

  const emitCopilotExitTelemetry = useCallback(() => {
    if (copilotExitHandledRef.current) {
      return;
    }

    copilotExitHandledRef.current = true;
    const latest = latestExitPayloadRef.current;

    void telemetryClient.sendTelemetryEvent(latest.tenantId, {
      eventName: "copilotkit_exit",
      missionId: latest.missionId,
      eventData: {
        session_identifier: sessionIdentifier,
        artifacts_count: latest.artifactsCount,
        stage: latest.stage,
      },
    });
  }, [sessionIdentifier]);

  useEffect(() => {
    if (sessionTelemetrySentRef.current) {
      return;
    }

    sessionTelemetrySentRef.current = true;
    void telemetryClient.sendTelemetryEvent(tenantId, {
      eventName: "copilotkit_session_started",
      missionId,
      eventData: {
        session_identifier: sessionIdentifier,
      },
    });
  }, [missionId, sessionIdentifier, tenantId]);

  useEffect(() => {
    window.addEventListener("beforeunload", emitCopilotExitTelemetry);
    return () => {
      emitCopilotExitTelemetry();
      window.removeEventListener("beforeunload", emitCopilotExitTelemetry);
    };
  }, [emitCopilotExitTelemetry]);

  useEffect(() => {
    if (!sessionIdentifier || lastHydratedSessionRef.current === sessionIdentifier) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const hydrateSession = async () => {
      try {
        const query = new URLSearchParams({
          agentId: AGENT_ID,
          tenantId,
          sessionIdentifier,
        });

        const response = await fetch(`/api/copilotkit/session?${query.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { state?: CopilotSessionSnapshot };
        if (cancelled) {
          return;
        }

        const snapshot = payload?.state;
        if (!snapshot) {
          return;
        }

        if (Array.isArray(snapshot.artifacts)) {
          setArtifacts(snapshot.artifacts);
        }

        if (Object.prototype.hasOwnProperty.call(snapshot, "objectiveId")) {
          setObjectiveId(snapshot.objectiveId ?? null);
        }

        if (snapshot.themeColor && typeof snapshot.themeColor === "string") {
          setThemeColor(snapshot.themeColor);
        }

        if (snapshot.missionBrief && typeof snapshot.missionBrief === "object") {
          setMissionBrief(snapshot.missionBrief);
        }

        if (Array.isArray(snapshot.safeguards)) {
          setSafeguards(snapshot.safeguards);
        }

        if (Array.isArray(snapshot.safeguardHistory)) {
          setSafeguardHistory(snapshot.safeguardHistory);
        }

        if (
          Object.prototype.hasOwnProperty.call(snapshot, "selectedFeedbackRating") &&
          (typeof snapshot.selectedFeedbackRating === "number" || snapshot.selectedFeedbackRating === null)
        ) {
          setSelectedFeedbackRating(snapshot.selectedFeedbackRating);
        }

        if (Array.isArray(snapshot.plannerRuns)) {
          setPlannerRuns(
            snapshot.plannerRuns.filter((entry): entry is PlannerRunSnapshot =>
              Boolean(entry && typeof entry.id === "string" && typeof entry.createdAt === "string"),
            ),
          );
        }

        const snapshotMissionId =
          (typeof snapshot.objectiveId === "string" && snapshot.objectiveId.length > 0
            ? snapshot.objectiveId
            : null) ?? missionId;

        const missionStagesEntry = (() => {
          const candidate = snapshot.missionStages as
            | HydratedMissionStage[]
            | Record<string, unknown>
            | undefined
            | null;

          if (Array.isArray(candidate)) {
            return candidate;
          }

          if (!candidate || typeof candidate !== "object") {
            return undefined;
          }

          const stagesByKey = candidate as Record<string, unknown>;
          const lookupKeys: Array<string | null | undefined> = [snapshotMissionId, missionId, "", null, "null"];

          for (const key of lookupKeys) {
            if (typeof key === "undefined") {
              continue;
            }
            const value = stagesByKey[key as keyof typeof stagesByKey];
            if (Array.isArray(value)) {
              return value as HydratedMissionStage[];
            }
          }

          const firstArray = Object.values(stagesByKey).find((value): value is HydratedMissionStage[] =>
            Array.isArray(value),
          );

          return firstArray;
        })();

        restoreMissionStages(missionStagesEntry);
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        if (!isAbort) {
          console.error("[ControlPlaneWorkspace] failed to hydrate Copilot session", error);
        }
      } finally {
        if (!cancelled) {
          lastHydratedSessionRef.current = sessionIdentifier;
          markHydrationComplete();
        }
      }
    };

    void hydrateSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [markHydrationComplete, missionId, restoreMissionStages, sessionIdentifier, tenantId]);

  const handleSafeguardTelemetry = useCallback(
    (eventName: string, data: Record<string, unknown>) => {
      void telemetryClient.sendTelemetryEvent(tenantId, {
        eventName,
        missionId,
        eventData: data,
      });
    },
    [missionId, tenantId],
  );

  const postSafeguardMutation = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!missionId) {
        return;
      }
      try {
        await fetch("/api/safeguards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, missionId, ...payload }),
        });
      } catch (error) {
        console.warn("[SafeguardDrawer] failed to persist safeguard mutation", error);
      }
    },
    [missionId, tenantId],
  );

  const handleSafeguardAcceptAll = useCallback(() => {
    if (!safeguards.length) {
      return;
    }

    const timestamp = new Date().toISOString();
    setSafeguards((prev) =>
      prev.map((hint) => ({ ...hint, status: "accepted", lastUpdatedAt: timestamp })),
    );

    appendSafeguardHistory(
      safeguards.map((hint) => ({
        id: `${hint.id}-accept-all`,
        label: hint.label,
        status: "accepted",
        timestamp,
      })),
    );

    handleSafeguardTelemetry("safeguard_hint_accept_all", {
      hint_ids: safeguards.map((hint) => hint.id),
      hint_count: safeguards.length,
    });

    void postSafeguardMutation({ action: "accept_all", hintIds: safeguards.map((hint) => hint.id) });
  }, [appendSafeguardHistory, handleSafeguardTelemetry, postSafeguardMutation, safeguards]);

  const handleSafeguardAccept = useCallback(
    (hint: SafeguardDrawerHint) => {
      const timestamp = new Date().toISOString();
      setSafeguards((prev) =>
        prev.map((entry) =>
          entry.id === hint.id
            ? { ...entry, status: "accepted", lastUpdatedAt: timestamp }
            : entry,
        ),
      );

      appendSafeguardHistory([
        {
          id: `${hint.id}-accepted`,
          label: hint.label,
          status: "accepted",
          timestamp,
        },
      ]);

      handleSafeguardTelemetry("safeguard_hint_applied", {
        hint_id: hint.id,
        hint_type: hint.hintType,
      });

      void postSafeguardMutation({ action: "accept", hintId: hint.id });
    },
    [appendSafeguardHistory, handleSafeguardTelemetry, postSafeguardMutation],
  );

  const handleSafeguardEdit = useCallback(
    (hint: SafeguardDrawerHint) => {
      const nextText = window.prompt("Edit safeguard", hint.label)?.trim();
      if (!nextText || nextText === hint.label) {
        return;
      }

      const timestamp = new Date().toISOString();
      setSafeguards((prev) =>
        prev.map((entry) =>
          entry.id === hint.id
            ? { ...entry, label: nextText, status: "edited", lastUpdatedAt: timestamp }
            : entry,
        ),
      );

      appendSafeguardHistory([
        {
          id: `${hint.id}-edited`,
          label: nextText,
          status: "edited",
          timestamp,
        },
      ]);

      handleSafeguardTelemetry("safeguard_hint_edited", {
        hint_id: hint.id,
        hint_type: hint.hintType,
        text_length: nextText.length,
      });

      void postSafeguardMutation({ action: "edit", hintId: hint.id, text: nextText });
    },
    [appendSafeguardHistory, handleSafeguardTelemetry, postSafeguardMutation],
  );

  const handleSafeguardRegenerate = useCallback(
    (hint: SafeguardDrawerHint) => {
      handleSafeguardTelemetry("safeguard_hint_regenerate_requested", {
        hint_id: hint.id,
        hint_type: hint.hintType,
      });

      void postSafeguardMutation({ action: "regenerate", hintId: hint.id });
    },
    [handleSafeguardTelemetry, postSafeguardMutation],
  );

  const handleSafeguardTogglePin = useCallback(
    (hint: SafeguardDrawerHint, nextPinned: boolean) => {
      setSafeguards((prev) =>
        prev.map((entry) => (entry.id === hint.id ? { ...entry, pinned: nextPinned } : entry)),
      );

      appendSafeguardHistory([
        {
          id: `${hint.id}-pin-${nextPinned ? "on" : "off"}`,
          label: hint.label,
          status: nextPinned ? "pinned" : "unpinned",
          timestamp: new Date().toISOString(),
        },
      ]);

      handleSafeguardTelemetry("safeguard_hint_toggle_pin", {
        hint_id: hint.id,
        hint_type: hint.hintType,
        pinned: nextPinned,
      });

      void postSafeguardMutation({ action: "toggle_pin", hintId: hint.id, pinned: nextPinned });
    },
    [appendSafeguardHistory, handleSafeguardTelemetry, postSafeguardMutation],
  );

  const handleSafeguardHistoryToggle = useCallback(
    (isOpen: boolean) => {
      setSafeguardHistoryOpen(isOpen);
      handleSafeguardTelemetry(isOpen ? "safeguard_hint_history_opened" : "safeguard_hint_history_closed", {
        entry_count: safeguardHistory.length,
      });
    },
    [handleSafeguardTelemetry, safeguardHistory.length],
  );

  const handlePlannerTimelineUpdate = useCallback((events: TimelineMessage[]) => {
    if (!Array.isArray(events)) {
      return;
    }

    const latest = events
      .filter((event) => event.stage?.startsWith("planner"))
      .slice(-10)
      .map<PlannerRunSnapshot>((event) => ({
        id: event.id,
        stage: event.stage,
        event: event.event,
        createdAt: event.createdAt,
        label: event.label,
        description: event.description,
        metadata: event.metadata ?? null,
      }));

    setPlannerRuns(latest);
  }, []);

  const markStageIfNeeded = useCallback(
    (stage: MissionStage) => {
      const status = stages.get(stage);
      if (!status || status.state === "completed" || status.state === "failed") {
        return;
      }
      markStageCompleted(stage);
    },
    [stages, markStageCompleted],
  );

  const undoFlow = useUndoFlow({
    tenantId,
    missionId,
    onCompleted: (status) => {
      clearUndoBannerState("completed");
      setWorkspaceAlert({
        tone: "success",
        message:
          status === "completed"
            ? "Undo executed for the selected artifact."
            : "Undo request queued for evidence service.",
      });

      if (status === "completed") {
        markStageIfNeeded(MissionStage.Evidence);
        const feedbackStatus = stages.get(MissionStage.Feedback);
        if (feedbackStatus?.state === "pending") {
          markStageStarted(MissionStage.Feedback);
        }
      }
    },
  });

  const handleUndoBannerAction = useCallback(() => {
    if (!undoBanner) {
      return;
    }

    void telemetryClient.sendTelemetryEvent(tenantId, {
      eventName: "undo_triggered",
      missionId: missionId ?? undefined,
      eventData: {
        tool_call_id: undoBanner.toolCallId,
        undo_token: undoBanner.undoToken ?? null,
      },
    });

    void undoFlow.requestUndo({
      toolCallId: undoBanner.toolCallId,
      missionId,
      reason: "User triggered undo countdown banner",
      undoToken: undoBanner.undoToken ?? undefined,
    });
  }, [missionId, tenantId, undoBanner, undoFlow]);

  const buildSessionSnapshot = useCallback((): CopilotSessionSnapshot => ({
    artifacts,
    objectiveId: missionId,
    missionStages: missionStageSnapshot,
    missionBrief,
    safeguards,
    safeguardHistory,
    selectedFeedbackRating,
    themeColor,
    plannerRuns,
  }), [
    artifacts,
    missionId,
    missionStageSnapshot,
    missionBrief,
    safeguards,
    safeguardHistory,
    selectedFeedbackRating,
    themeColor,
    plannerRuns,
  ]);

  const syncCopilotSession = useCallback(
    async (overrides?: Partial<CopilotSessionSnapshot>) => {
      const baseSnapshot = buildSessionSnapshot();
      const sessionState: CopilotSessionSnapshot = overrides
        ? { ...baseSnapshot, ...overrides }
        : baseSnapshot;
      const sessionIdentifierValue = sessionIdentifierRef.current;

      if (!sessionIdentifierValue) {
        return;
      }

      try {
        await fetch("/api/copilotkit/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: AGENT_ID,
            sessionIdentifier: sessionIdentifierValue,
            tenantId,
            state: sessionState,
            retentionMinutes: SESSION_RETENTION_MINUTES,
          }),
        });
      } catch (error) {
        console.error("Failed to sync Copilot session", error);
      }
    },
    [buildSessionSnapshot, tenantId],
  );

  useEffect(() => {
    if (!hydrationComplete) {
      return;
    }

    void syncCopilotSession();
  }, [hydrationComplete, syncCopilotSession]);

  const persistCopilotMessage = useCallback(
    async ({
      role,
      content,
      metadata,
    }: {
      role: string;
      content: string;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        await fetch("/api/copilotkit/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: AGENT_ID,
            tenantId,
            sessionIdentifier: sessionIdentifierRef.current,
            role,
            content,
            metadata,
          }),
        });
      } catch (error) {
        console.error("Failed to persist Copilot message", error);
      }
    },
    [tenantId],
  );

  const copyToClipboard = useCallback(async (value: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        console.warn("Clipboard API failed, falling back", error);
      }
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = value;
      textArea.setAttribute("readonly", "");
      textArea.style.position = "absolute";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch (error) {
      console.warn("Fallback clipboard copy failed", error);
      return false;
    }
  }, []);

  const handleArtifactExport = useCallback(
    async (artifact: Artifact, format: "csv" | "pdf") => {
      try {
        const response = await fetch("/api/artifacts/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifact, format }),
        });

        if (!response.ok) {
          throw new Error(`Export failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const extension = format === "pdf" ? "pdf" : "csv";
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${artifact.artifact_id}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setWorkspaceAlert({
          tone: "success",
          message: `${format.toUpperCase()} downloaded for ${artifact.title}.`,
        });

        void telemetryClient.sendTelemetryEvent(tenantId, {
          eventName: "artifact_exported",
          missionId,
          eventData: {
            artifact_id: artifact.artifact_id,
            format,
          },
        });
      } catch (error) {
        console.error("Artifact export failed", error);
        setWorkspaceAlert({
          tone: "error",
          message: `Unable to export ${format.toUpperCase()} for ${artifact.title}.`,
        });
      }
    },
    [missionId, tenantId],
  );

  const handleArtifactShare = useCallback(
    async (artifact: Artifact) => {
      try {
        const response = await fetch("/api/artifacts/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifact }),
        });

        if (!response.ok) {
          throw new Error(`Share link failed with status ${response.status}`);
        }

        const { shareUrl } = (await response.json()) as { shareUrl?: string };

        if (!shareUrl) {
          throw new Error("Share URL missing from response");
        }

        const copied = await copyToClipboard(shareUrl);

        setWorkspaceAlert({
          tone: "success",
          message: copied
            ? "Share link copied to clipboard."
            : `Share link ready: ${shareUrl}`,
        });

        void telemetryClient.sendTelemetryEvent(tenantId, {
          eventName: "artifact_share_link_created",
          missionId,
          eventData: {
            artifact_id: artifact.artifact_id,
            copied,
          },
        });
      } catch (error) {
        console.error("Artifact share link generation failed", error);
        setWorkspaceAlert({
          tone: "error",
          message: `Unable to create a share link for ${artifact.title}.`,
        });
      }
    },
    [copyToClipboard, missionId, tenantId],
  );

  const handleAddPlaceholderArtifact = useCallback(() => {
    const id = `artifact-${Date.now()}`;
    const placeholder: Artifact = {
      artifact_id: id,
      title: "Approval summary placeholder",
      summary: "Use the agent to replace this with a real dry-run asset.",
      status: "draft",
    };

    setArtifacts((current) => {
      const nextArtifacts = [...current, placeholder];

      void (async () => {
        try {
          await fetch("/api/artifacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              artifactId: id,
              title: placeholder.title,
              summary: placeholder.summary,
              status: placeholder.status,
              tenantId,
              playId: missionId ?? undefined,
            }),
          });
        } catch (error) {
          console.error("Failed to persist placeholder artifact", error);
        }
      })();

      return nextArtifacts;
    });
  }, [missionId, tenantId]);

  const handleArtifactUndo = useCallback(
    (artifact: Artifact) => {
      void undoFlow.requestUndo({
        toolCallId: artifact.artifact_id,
        reason: "User requested dry-run rollback",
        undoToken: artifact.undo_token ?? undefined,
      });
    },
    [undoFlow],
  );

  const handleEvidenceHashCopy = useCallback(
    async (artifact: Artifact) => {
      const hash = artifact.evidence_hash ?? artifact.checksum ?? artifact.hash ?? null;
      if (!hash) {
        return;
      }

      const copied = await copyToClipboard(hash);

      setWorkspaceAlert({
        tone: copied ? "success" : "info",
        message: copied ? "Evidence hash copied to clipboard." : hash,
      });

      void telemetryClient.sendTelemetryEvent(tenantId, {
        eventName: "evidence_hash_copied",
        missionId,
        eventData: {
          artifact_id: artifact.artifact_id,
          copied,
          hash_length: hash.length,
        },
      });
    },
    [copyToClipboard, missionId, tenantId],
  );

  useCopilotAction({
    name: "copilotkit_emit_message",
    description: "Persist a message from the Copilot runloop",
    parameters: [
      { name: "role", type: "string", required: true },
      { name: "content", type: "string", required: true },
      { name: "metadata", type: "object", required: false },
    ],
    handler: async ({ role, content, metadata }) => {
      if (!role || !content) {
        return "Missing role or content";
      }
      await persistCopilotMessage({
        role: typeof role === "string" ? role : "assistant",
        content: String(content),
        metadata: (metadata as Record<string, unknown> | undefined) ?? {},
      });
      return "Copilot message stored.";
    },
  });

  useCopilotAction({
    name: "copilotkit_exit",
    description: "Persist a completion event for the active CopilotKit session.",
    parameters: [{ name: "reason", type: "string", required: false }],
    handler: async ({ reason }) => {
      if (copilotExitHandledRef.current) {
        return "Copilot session already closed.";
      }

      try {
        await persistCopilotMessage({
          role: "system",
          content: `Session exited: ${reason ?? "completed"}`,
          metadata: { reason: reason ?? "completed" },
        });

        emitCopilotExitTelemetry();
        await syncCopilotSession();
        return "Copilot session marked as completed.";
      } catch (error) {
        copilotExitHandledRef.current = false;
        throw error;
      }
    },
  });

  useCopilotAction({
    name: "copilotkit_clear_session",
    description: "Clear all persisted CopilotKit messages for this session.",
    parameters: [],
    handler: async () => {
      try {
        await fetch("/api/copilotkit/message", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: AGENT_ID,
            tenantId,
            sessionIdentifier: sessionIdentifierRef.current,
          }),
        });
      } catch (error) {
        console.error("Failed to clear Copilot messages", error);
      }
      await syncCopilotSession();
      return "Copilot session cleared.";
    },
  });

  useCopilotAction({
    name: "registerArtifactPreview",
    description: "Publish or update an artifact card for the current mission.",
    parameters: [
      { name: "artifactId", type: "string", required: false },
      { name: "title", type: "string", required: true },
      { name: "summary", type: "string", required: true },
      { name: "status", type: "string", required: false },
    ],
    handler: async ({ artifactId, title, summary, status }) => {
      if (!title || !summary) {
        return "Title and summary are required.";
      }

      const candidateId =
        typeof artifactId === "string" && artifactId.trim()
          ? artifactId
          : typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `artifact-${Date.now()}`;

      try {
        const response = await fetch("/api/artifacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artifactId: candidateId,
            title,
            summary,
            status,
            tenantId,
            playId: objectiveId ?? undefined,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? "Artifact persistence failed");
        }

        const payload = (await response.json()) as {
          artifact?: {
            id?: string | null;
            title?: string | null;
            content?: { summary?: string } | null;
            status?: string | null;
          } | null;
        };

        const storedId = payload.artifact?.id ?? candidateId;
        const storedSummary =
          payload.artifact?.content && typeof payload.artifact.content === "object"
            ? payload.artifact.content.summary ?? summary
            : summary;

        const nextArtifact: Artifact = {
          artifact_id: storedId,
          title: payload.artifact?.title ?? title,
          summary: storedSummary,
          status: payload.artifact?.status ?? (typeof status === "string" ? status : "draft"),
        };

        const merged = [
          nextArtifact,
          ...artifacts.filter((artifact) => artifact.artifact_id !== storedId),
        ].sort((a, b) => a.title.localeCompare(b.title));

        setArtifacts(merged);
        await syncCopilotSession({ artifacts: merged });

        return `Artifact ${storedId} registered.`;
      } catch (error) {
        console.error(error);
        return error instanceof Error ? error.message : "Failed to register artifact.";
      }
    },
  });

  useEffect(() => {
    setIsSidebarReady(true);
  }, []);

  useEffect(() => {
    if (!workspaceAlert) {
      return undefined;
    }
    const timer = setTimeout(() => setWorkspaceAlert(null), 6000);
    return () => clearTimeout(timer);
  }, [workspaceAlert]);

  useEffect(() => {
    if (!undoFlow.error) {
      return;
    }
    setWorkspaceAlert({
      tone: "error",
      message: undoFlow.error,
    });
  }, [undoFlow.error]);

  const handleReviewerRequested = useCallback(
    (message: TimelineMessage) => {
      const resolvedToolCall =
        (message.metadata?.tool_call_id as string | undefined) ??
        (message.metadata?.toolCallId as string | undefined) ??
        null;

      if (!resolvedToolCall) {
        setWorkspaceAlert({
          tone: "error",
          message:
            "Validator requested a reviewer decision but the tool call identifier was not provided.",
        });
        return;
      }

      const derivedUndoSummary =
        typeof message.metadata?.undo_summary === "string"
          ? (message.metadata.undo_summary as string)
          : undefined;
      setApprovalUndoSummary(derivedUndoSummary);

      approvalFlow.openApproval({
        toolCallId: resolvedToolCall,
        missionId,
        stage: message.stage ?? null,
        attempt:
          typeof message.metadata?.attempt === "number"
            ? (message.metadata.attempt as number)
            : null,
        metadata: message.metadata,
        safeguards: acceptedSafeguardEntries.length ? acceptedSafeguardEntries : undefined,
      });
    },
    [acceptedSafeguardEntries, approvalFlow, missionId],
  );

  const handleSessionCancel = useCallback(() => {
    setWorkspaceAlert({
      tone: "warning",
      message: "Dry-run cancelled. You can resume by launching a new mission stage.",
    });
    markStageCompleted(MissionStage.DryRun, { reason: "cancelled" });
  }, [markStageCompleted]);

  const handleSessionRetry = useCallback(() => {
    setWorkspaceAlert({
      tone: "info",
      message: "Retry requested. The agent will attempt the dry-run again shortly.",
    });
    markStageStarted(MissionStage.DryRun, { reason: "retry_requested" });
  }, [markStageStarted]);

  const submitApproval = useCallback(
    (submission: ApprovalSubmission) =>
      approvalFlow.submitApproval({
        ...submission,
        safeguards: acceptedSafeguardEntries.length ? acceptedSafeguardEntries : undefined,
      }),
    [acceptedSafeguardEntries, approvalFlow],
  );

  useEffect(() => {
    if (!approvalFlow.isOpen) {
      setApprovalUndoSummary(undefined);
    }
  }, [approvalFlow.isOpen]);

  const handleIntakeAccept = useCallback(
    async ({
      missionId: nextMissionId,
      objective,
      audience,
      guardrailSummary,
      kpis,
      confidence,
    }: AcceptedIntakePayload) => {
      const currentMissionId = nextMissionId;
      setObjectiveId(currentMissionId);

      const normalizedObjective = objective ?? "";
      const normalizedAudience = audience ?? "";
      const normalizedKpis = Array.isArray(kpis) ? kpis : [];

      const acceptedSafeguards = (guardrailSummary ?? '')
        .split(/\n+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((text) => ({ hintType: null, text }));

      const normalizedConfidence: Record<string, number | null> | undefined =
        typeof confidence === "number"
          ? {
              objective: confidence,
              audience: confidence,
              kpis: confidence,
            }
          : undefined;

      const nextMissionBrief: MissionBriefState = {
        missionId: currentMissionId,
        objective: normalizedObjective,
        audience: normalizedAudience,
        kpis: normalizedKpis,
        safeguards: acceptedSafeguards,
        confidence: normalizedConfidence,
        source: null,
      };

      const nextSafeguards = normalizeSafeguards(acceptedSafeguards, safeguards);

      setMissionBrief(nextMissionBrief);
      setSafeguards(nextSafeguards);
      setSafeguardHistory([]);
      setSafeguardHistoryOpen(false);
      hasPinnedBriefRef.current = false;

      void telemetryClient.sendTelemetryEvent(tenantId, {
        eventName: "mission_brief_updated",
        missionId: currentMissionId,
        eventData: {
          kpi_count: normalizedKpis.length,
          safeguard_count: acceptedSafeguards.length,
        },
      });

      await syncCopilotSession({
        objectiveId: currentMissionId,
        missionBrief: nextMissionBrief,
        safeguards: nextSafeguards,
        safeguardHistory: [],
      });
    },
    [safeguards, syncCopilotSession, tenantId],
  );

  const handleIntakeAdvance = useCallback(() => {
    markStageIfNeeded(MissionStage.Intake);
    markStageIfNeeded(MissionStage.Brief);
  }, [markStageIfNeeded]);

  const handleToolkitsAdvance = useCallback(() => {
    markStageIfNeeded(MissionStage.Brief);
    markStageIfNeeded(MissionStage.Toolkits);
  }, [markStageIfNeeded]);

  const handleInspectionComplete = useCallback(() => {
    markStageIfNeeded(MissionStage.Inspect);
  }, [markStageIfNeeded]);

  const handlePlanComplete = useCallback(() => {
    const planStatus = stages.get(MissionStage.Plan);
    if (planStatus?.state !== "completed") {
      markStageCompleted(MissionStage.Plan);
    }

    const dryRunStatus = stages.get(MissionStage.DryRun);
    if (dryRunStatus?.state === "pending") {
      markStageStarted(MissionStage.DryRun);
    }
  }, [stages, markStageCompleted, markStageStarted]);

  const handleDryRunComplete = useCallback(() => {
    const dryRunStatus = stages.get(MissionStage.DryRun);
    if (dryRunStatus?.state !== "completed") {
      markStageCompleted(MissionStage.DryRun);
    }

    const evidenceStatus = stages.get(MissionStage.Evidence);
    if (evidenceStatus?.state === "pending") {
      markStageStarted(MissionStage.Evidence);
    }
  }, [stages, markStageCompleted, markStageStarted]);

  const handleFeedbackDrawerOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!canDisplayFeedbackDrawer) {
        setFeedbackDrawerOpen(false);
        return;
      }

      if (nextOpen) {
        const feedbackStatus = stages.get(MissionStage.Feedback);
        if (feedbackStatus?.state === "pending") {
          markStageStarted(MissionStage.Feedback);
        }
      }

      setFeedbackDrawerOpen(nextOpen);
    },
    [canDisplayFeedbackDrawer, stages, markStageStarted],
  );

  const handleFeedbackRatingChange = useCallback((rating: number | null) => {
    setSelectedFeedbackRating(rating);
  }, []);

  const handleFeedbackSubmit = useCallback(
    async ({ rating, comment }: { rating: number | null; comment: string }) => {
      if (!objectiveId) {
        const message = "We need an active mission before capturing feedback.";
        setWorkspaceAlert({ tone: "error", message });
        throw new Error(message);
      }

      const trimmedComment = comment.trim();
      const learningSignals = {
        source: "control_plane_feedback_drawer",
        has_comment: trimmedComment.length > 0,
        comment_length: trimmedComment.length,
        rating: rating ?? null,
      } satisfies Record<string, unknown>;

      const payload: Record<string, unknown> = {
        missionId: objectiveId,
        feedbackText: trimmedComment || undefined,
        learningSignals,
      };

      if (rating != null) {
        payload.rating = rating;
      }

      try {
        const feedbackEndpoint = "/api/feedback/submit";
        const targetUrl =
          typeof window !== "undefined"
            ? new URL(feedbackEndpoint, window.location.origin).toString()
            : feedbackEndpoint;

        const response = await fetch(targetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const responseBody = await response
          .json()
          .catch(() => ({ error: "Failed to parse feedback response" }));

        if (!response.ok) {
          const message =
            typeof responseBody?.error === "string"
              ? responseBody.error
              : "Failed to submit mission feedback.";
          setWorkspaceAlert({ tone: "error", message });
          throw new Error(message);
        }

        setWorkspaceAlert({
          tone: "success",
          message: "Thanks for the feedback—this will help tune future dry runs.",
        });

        void telemetryClient.sendTelemetryEvent(tenantId, {
          eventName: "feedback_submitted",
          missionId: objectiveId,
          eventData: {
            rating,
            comment: trimmedComment,
            stage: MissionStage.Feedback,
          },
        });

        const feedbackStatus = stages.get(MissionStage.Feedback);
        if (feedbackStatus && feedbackStatus.state !== "completed" && feedbackStatus.state !== "failed") {
          markStageCompleted(MissionStage.Feedback, {
            rating,
            comment_length: trimmedComment.length,
          });
        }

        setSelectedFeedbackRating(rating ?? null);
      } catch (error) {
        console.error("[ControlPlaneWorkspace] feedback submission failed", error);
        if (!(error instanceof Error)) {
          throw new Error("Failed to submit mission feedback.");
        }
        throw error;
      }
    },
    [
      markStageCompleted,
      objectiveId,
      setWorkspaceAlert,
      tenantId,
      setSelectedFeedbackRating,
      stages,
    ],
  );

  const handlePlannerSelect = useCallback(
    (payload: Record<string, unknown>) => {
      const title = typeof payload?.title === "string" ? payload.title : "Planner play";
      setWorkspaceAlert({
        tone: "success",
        message: `Selected plan: ${title}.`,
      });

      const candidateIndex = typeof payload?.candidateIndex === "number" ? payload.candidateIndex : null;
      const mode = typeof payload?.mode === "string" ? payload.mode : undefined;

      telemetryClient.sendTelemetryEvent(tenantId, {
        eventName: "plan_validated",
        missionId: objectiveId ?? undefined,
        eventData: {
          selected_title: title,
          candidate_index: candidateIndex,
          mode,
        },
      });

      handlePlanComplete();
    },
    [tenantId, objectiveId, handlePlanComplete],
  );

  const handleToolkitSelectionChange = useCallback((count: number) => {
    setSelectedToolkitsCount(count);
  }, []);

  useEffect(() => {
    const dryRunStatus = stages.get(MissionStage.DryRun);
    const evidenceStatus = stages.get(MissionStage.Evidence);
    if (dryRunStatus?.state === "completed" && evidenceStatus?.state === "pending") {
      markStageStarted(MissionStage.Evidence);
    }
  }, [stages, markStageStarted]);

  const evidenceCompletionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!artifacts.length) {
      return;
    }

    const evidenceStatus = stages.get(MissionStage.Evidence);
    if (!evidenceStatus || evidenceStatus.state === "completed" || evidenceStatus.state === "failed") {
      return;
    }

    if (evidenceCompletionTimeoutRef.current) {
      clearTimeout(evidenceCompletionTimeoutRef.current);
      evidenceCompletionTimeoutRef.current = null;
    }

    if (evidenceStatus.state === "active") {
      const MIN_ACTIVE_WINDOW_MS = 200;
      const startedAtMs = evidenceStatus.startedAt?.getTime() ?? Date.now();
      const elapsed = Date.now() - startedAtMs;
      const delay = Math.max(MIN_ACTIVE_WINDOW_MS - elapsed, 0);

      evidenceCompletionTimeoutRef.current = setTimeout(() => {
        markStageIfNeeded(MissionStage.Evidence);
      }, delay || 0);
      return;
    }

    const dryRunStatus = stages.get(MissionStage.DryRun);
    if (evidenceStatus.state === "pending" && dryRunStatus?.state === "completed") {
      markStageStarted(MissionStage.Evidence);
    }

    return () => {
      if (evidenceCompletionTimeoutRef.current) {
        clearTimeout(evidenceCompletionTimeoutRef.current);
        evidenceCompletionTimeoutRef.current = null;
      }
    };
  }, [artifacts, stages, markStageIfNeeded, markStageStarted]);

  const showCoverageMeter = useMemo(() => {
    const inspectStatus = stages.get(MissionStage.Inspect);
    const toolkitStatus = stages.get(MissionStage.Toolkits);
    if (inspectStatus && inspectStatus.state !== "pending") {
      return true;
    }
    return toolkitStatus?.state === "completed";
  }, [stages]);

  return (
    <main
      style={{ "--copilot-kit-primary-color": themeColor } as CopilotKitCSSProperties}
      className="flex min-h-screen flex-col bg-slate-950 text-slate-50"
    >
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-violet-300">Gate G-B · Foundation ready</p>
            <h1 className="mt-1 text-2xl font-semibold">AI Employee Control Plane</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span className="hidden sm:inline">Theme</span>
            <input
              aria-label="Workspace accent colour"
              type="color"
              value={themeColor}
              className="h-8 w-10 cursor-pointer rounded border border-white/30 bg-transparent"
              onChange={(event) => setThemeColor(event.target.value)}
            />
          </div>
        </div>
      </header>

      {workspaceAlert && (
        <div className="mx-auto mt-4 w-full max-w-6xl px-6">
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              workspaceAlert.tone === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : workspaceAlert.tone === "error"
                  ? "border-red-500/40 bg-red-500/10 text-red-200"
                  : "border-slate-400/30 bg-slate-500/10 text-slate-200"
            }`}
          >
            {workspaceAlert.message}
          </div>
        </div>
      )}

      <MissionStageProgress />

      {missionBrief && (
        <MissionBriefCard
          brief={{
            objective: missionBrief.objective,
            audience: missionBrief.audience,
            kpis: missionBrief.kpis,
            safeguards: missionBrief.safeguards,
            confidence: missionBrief.confidence,
            source: missionBrief.source ?? null,
          }}
        />
      )}

      <MissionIntake
        tenantId={tenantId}
        objectiveId={missionId}
        onAccept={handleIntakeAccept}
        onStageAdvance={handleIntakeAdvance}
      />

      <RecommendedToolStrip
        tenantId={tenantId}
        missionId={missionId}
        onAlert={setWorkspaceAlert}
        onStageAdvance={handleToolkitsAdvance}
        onSelectionChange={handleToolkitSelectionChange}
      />

      {showCoverageMeter && (
        <CoverageMeter
          tenantId={tenantId}
          missionId={missionId}
          selectedToolkitsCount={selectedToolkitsCount}
          hasArtifacts={artifacts.length > 0}
          onComplete={handleInspectionComplete}
        />
      )}

      <PlannerInsightRail
        tenantId={tenantId}
        missionId={missionId}
        sessionIdentifier={sessionIdentifier}
        plannerRuns={plannerRuns}
        onSelectPlay={handlePlannerSelect}
        onStageAdvance={handlePlanComplete}
        onTimelineUpdate={handlePlannerTimelineUpdate}
      />

      <div className="flex grow flex-col lg:flex-row">
        <section className="flex w-full flex-col gap-6 border-b border-white/10 px-6 py-8 lg:w-2/5 lg:border-r lg:border-b-0">
          <SafeguardDrawer
            safeguards={safeguards}
            historyItems={safeguardHistory}
            isBusy={false}
            onAcceptAll={handleSafeguardAcceptAll}
            onAccept={handleSafeguardAccept}
            onEdit={handleSafeguardEdit}
            onRegenerate={handleSafeguardRegenerate}
            onTogglePin={handleSafeguardTogglePin}
            onHistoryToggle={handleSafeguardHistoryToggle}
          />

          {undoBanner && (
            <ArtifactUndoBar
              summary={undoBanner.summary}
              riskTags={undoBanner.riskTags}
              expiresAt={undoBanner.expiresAt}
              onUndo={handleUndoBannerAction}
              isUndoing={undoFlow.isRequesting}
              overrideAllowed={undoBanner.overrideAllowed}
              overrideUrl={undoBanner.overrideUrl}
              onExpired={handleUndoBannerExpired}
              onDismiss={() => clearUndoBannerState("dismissed")}
            />
          )}

          <ArtifactGallery
            className="flex flex-col gap-6"
            artifacts={artifacts}
            onAddPlaceholder={handleAddPlaceholderArtifact}
            onCopyHash={handleEvidenceHashCopy}
            onExport={handleArtifactExport}
            onShare={handleArtifactShare}
            onUndo={handleArtifactUndo}
            isUndoing={undoFlow.isRequesting}
          >
            {canDisplayFeedbackDrawer ? (
              <FeedbackDrawer
                tenantId={tenantId}
                missionId={missionId}
                currentStage={currentStage}
                isOpen={isFeedbackDrawerOpen}
                selectedRating={selectedFeedbackRating}
                onOpenChange={handleFeedbackDrawerOpenChange}
                onRatingChange={handleFeedbackRatingChange}
                onSubmit={handleFeedbackSubmit}
              />
            ) : null}
          </ArtifactGallery>
        </section>

        <StreamingStatusPanel
          tenantId={tenantId}
          agentId={AGENT_ID}
          sessionIdentifier={sessionIdentifier}
          pollIntervalMs={5000}
          onReviewerRequested={handleReviewerRequested}
          onCancelSession={handleSessionCancel}
          onRetrySession={handleSessionRetry}
          onPlanComplete={handlePlanComplete}
          onDryRunComplete={handleDryRunComplete}
          onUndoPlanDetected={handleUndoPlanDetected}
        />

        <section className="flex w-full flex-col bg-slate-950/70 lg:w-1/5">
          {isSidebarReady ? (
            <CopilotSidebar
              defaultOpen
              clickOutsideToClose={false}
              labels={{
                title: "Mission Copilot",
                initial:
                  "Use the control plane copilot to propose plays, summarise guardrails, and capture dry-run artifacts before requesting OAuth access.",
              }}
            />
          ) : (
            <SidebarSkeleton />
          )}

          <div className="mt-auto border-t border-white/10 bg-slate-950/80 p-5 text-xs text-slate-300">
            <h3 className="mb-2 text-sm font-semibold text-white">Catalog Snapshot</h3>
            {catalogSummary ? (
              <ul className="space-y-1">
                <li>Total entries: {catalogSummary.total_entries}</li>
                <li>Toolkits indexed: {catalogSummary.toolkits}</li>
                <li className="truncate">Categories: {catalogSummary.categories.join(", ")}</li>
              </ul>
            ) : (
              <p>Catalog metadata will load after the agent fetches the Composio cache.</p>
            )}
          </div>
        </section>
      </div>

      <ApprovalModal
        isOpen={approvalFlow.isOpen}
        isSubmitting={approvalFlow.isSubmitting}
        error={approvalFlow.error}
        onClose={approvalFlow.closeApproval}
        onSubmit={submitApproval}
        request={approvalFlow.currentRequest}
        safeguardChips={safeguardChips}
        undoSummary={approvalUndoSummary}
        latestDecision={approvalFlow.latestDecision}
        emitTelemetry={approvalFlow.emitTelemetry}
      />
    </main>
  );
}

export function ControlPlaneWorkspace(props: ControlPlaneWorkspaceProps) {
  return (
    <MissionStageProvider tenantId={props.tenantId} missionId={props.initialObjectiveId ?? null}>
      <ControlPlaneWorkspaceContent {...props} />
    </MissionStageProvider>
  );
}

function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col justify-between gap-4 border-b border-white/10 bg-slate-950/70 p-5">
      <div className="space-y-4">
        <div className="h-3 w-24 rounded-full bg-white/10" />
        <div className="space-y-2 text-xs text-slate-500">
          <div className="h-2 w-full rounded bg-white/10" />
          <div className="h-2 w-3/4 rounded bg-white/10" />
          <div className="h-2 w-2/3 rounded bg-white/10" />
        </div>
        <div className="h-32 rounded-xl border border-dashed border-white/10 bg-slate-900/60" />
      </div>
      <div className="space-y-2 text-[10px] uppercase tracking-wide text-slate-500">
        <div className="h-2 w-1/2 rounded bg-white/10" />
        <div className="h-2 w-2/3 rounded bg-white/10" />
      </div>
    </div>
  );
}
