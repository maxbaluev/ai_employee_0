"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar, type CopilotKitCSSProperties } from "@copilotkit/react-ui";

import { ApprovalModal } from "@/components/ApprovalModal";
import { CoverageMeter } from "@/components/CoverageMeter";
import { ArtifactGallery, type ArtifactGalleryArtifact } from "@/components/ArtifactGallery";
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
  MISSION_STAGE_ORDER,
  useMissionStages,
} from "@/components/mission-stages";
import type { MissionStageState, MissionStageStatus } from "@/components/mission-stages";
import type { TimelineMessage } from "@/hooks/useTimelineEvents";
import { useApprovalFlow } from "@/hooks/useApprovalFlow";
import type { ApprovalSubmission, SafeguardEntry } from "@/hooks/useApprovalFlow";
import { useUndoFlow } from "@/hooks/useUndoFlow";
import { PlannerInsightRail } from "@/components/PlannerInsightRail";
import * as telemetryClient from "@/lib/telemetry/client";

type Artifact = ArtifactGalleryArtifact;

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

type CopilotSessionSnapshot = {
  artifacts?: Artifact[];
  objectiveId?: string | null;
  missionStages?: HydratedMissionStage[];
  missionBrief?: MissionBriefState | null;
  safeguards?: SafeguardDrawerHint[];
  selectedFeedbackRating?: number | null;
  themeColor?: string;
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

const hashString = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const buildSafeguardId = (
  hint: { hintType: string | null; text: string },
  occurrence: number,
): string => {
  const type = hint.hintType ?? "hint";
  return `${type}-${hashString(hint.text)}-${occurrence}`;
};

const normalizeSafeguards = (
  hints: Array<{ hintType: string | null; text: string }>,
  previous: SafeguardDrawerHint[],
): SafeguardDrawerHint[] => {
  const previousById = new Map(previous.map((hint) => [hint.id, hint]));
  const seen: Record<string, number> = {};

  return hints.map((hint) => {
    const key = `${hint.hintType ?? "hint"}|${hint.text}`;
    const occurrence = seen[key] ?? 0;
    seen[key] = occurrence + 1;
    const id = buildSafeguardId(hint, occurrence);
    const existing = previousById.get(id);

    if (existing) {
      return existing;
    }

    return {
      id,
      label: hint.text,
      hintType: hint.hintType ?? "unspecified",
      status: "accepted",
      confidence: null,
      pinned: false,
      rationale: null,
      lastUpdatedAt: null,
    } satisfies SafeguardDrawerHint;
  });
};

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
    markStageFailed,
    hydrateStages,
  } = useMissionStages();
  const [themeColor, setThemeColor] = useState("#4f46e5");
  const [artifacts, setArtifacts] = useState<Artifact[]>(initialArtifacts);
  const [objectiveId, setObjectiveId] = useState<string | undefined | null>(initialObjectiveId);
  const [isSidebarReady, setIsSidebarReady] = useState(false);
  const [workspaceAlert, setWorkspaceAlert] = useState<
    { tone: "success" | "error" | "info"; message: string } | null
  >(null);
  const [selectedToolkitsCount, setSelectedToolkitsCount] = useState(0);
  const [isFeedbackDrawerOpen, setFeedbackDrawerOpen] = useState(false);
  const [selectedFeedbackRating, setSelectedFeedbackRating] = useState<number | null>(null);
  const [missionBrief, setMissionBrief] = useState<MissionBriefState | null>(null);
  const [safeguards, setSafeguards] = useState<SafeguardDrawerHint[]>([]);
  const [safeguardHistory, setSafeguardHistory] = useState<SafeguardDrawerHistoryItem[]>([]);
  const [, setSafeguardHistoryOpen] = useState(false);
  const [approvalUndoSummary, setApprovalUndoSummary] = useState<string | undefined>(undefined);
  const hasPinnedBriefRef = useRef(false);
  const copilotExitHandledRef = useRef(false);
  const lastHydratedSessionRef = useRef<string | null>(null);

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
      missionId: objectiveId,
      eventData: {
        kpi_count: missionBrief.kpis.length,
        safeguard_count: missionBrief.safeguards.length,
      },
    });
  }, [missionBrief, objectiveId, tenantId]);

  const sessionIdentifierRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `mission-${Date.now()}`,
  );
  const sessionIdentifier = sessionIdentifierRef.current;

  const readableState = useMemo(
    () => ({
      artifacts,
      objectiveId: objectiveId ?? null,
    }),
    [artifacts, objectiveId],
  );

  useCopilotReadable({
    description: "Evidence artifacts tracked in the Gate G-A dry-run workspace",
    value: readableState,
  });

  const approvalFlow = useApprovalFlow({
    tenantId,
    missionId: objectiveId ?? null,
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
  }, [sessionIdentifier]);

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

        if (
          Object.prototype.hasOwnProperty.call(snapshot, "selectedFeedbackRating") &&
          (typeof snapshot.selectedFeedbackRating === "number" || snapshot.selectedFeedbackRating === null)
        ) {
          setSelectedFeedbackRating(snapshot.selectedFeedbackRating);
        }

        restoreMissionStages(snapshot.missionStages);
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        if (!isAbort) {
          console.error("[ControlPlaneWorkspace] failed to hydrate Copilot session", error);
        }
      } finally {
        if (!cancelled) {
          lastHydratedSessionRef.current = sessionIdentifier;
        }
      }
    };

    void hydrateSession();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [restoreMissionStages, sessionIdentifier, tenantId]);

  const handleSafeguardTelemetry = useCallback(
    (eventName: string, data: Record<string, unknown>) => {
      void telemetryClient.sendTelemetryEvent(tenantId, {
        eventName,
        missionId: objectiveId ?? null,
        eventData: data,
      });
    },
    [objectiveId, tenantId],
  );

  const postSafeguardMutation = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!objectiveId) {
        return;
      }
      try {
        await fetch("/api/safeguards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantId, missionId: objectiveId, ...payload }),
        });
      } catch (error) {
        console.warn("[SafeguardDrawer] failed to persist safeguard mutation", error);
      }
    },
    [objectiveId, tenantId],
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
    missionId: objectiveId ?? null,
    onCompleted: (status) => {
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

  const syncCopilotSession = useCallback(
    async (nextArtifacts: Artifact[], newObjectiveId?: string | null) => {
      try {
        await fetch("/api/copilotkit/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: AGENT_ID,
            sessionIdentifier: sessionIdentifierRef.current,
            tenantId,
            state: {
              artifacts: nextArtifacts,
              objectiveId: newObjectiveId ?? objectiveId ?? null,
            },
            retentionMinutes: SESSION_RETENTION_MINUTES,
          }),
        });
      } catch (error) {
        console.error("Failed to sync Copilot session", error);
      }
    },
    [objectiveId, tenantId],
  );

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
          missionId: objectiveId ?? null,
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
    [objectiveId, tenantId],
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
          missionId: objectiveId ?? null,
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
    [copyToClipboard, objectiveId, tenantId],
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
              playId: objectiveId ?? undefined,
            }),
          });
        } catch (error) {
          console.error("Failed to persist placeholder artifact", error);
        }

        await syncCopilotSession(nextArtifacts, objectiveId ?? null);
      })();

      return nextArtifacts;
    });
  }, [objectiveId, syncCopilotSession, tenantId]);

  const handleArtifactUndo = useCallback(
    (artifact: Artifact) => {
      void undoFlow.requestUndo({
        toolCallId: artifact.artifact_id,
        reason: "User requested dry-run rollback",
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
        missionId: objectiveId ?? null,
        eventData: {
          artifact_id: artifact.artifact_id,
          copied,
          hash_length: hash.length,
        },
      });
    },
    [copyToClipboard, objectiveId, tenantId],
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

      copilotExitHandledRef.current = true;

      try {
        await persistCopilotMessage({
          role: "system",
          content: `Session exited: ${reason ?? "completed"}`,
          metadata: { reason: reason ?? "completed" },
        });

        await syncCopilotSession([], null);
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
      await syncCopilotSession([], objectiveId ?? null);
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
        await syncCopilotSession(merged, objectiveId ?? null);

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
        missionId: objectiveId ?? null,
        stage: message.stage ?? null,
        attempt:
          typeof message.metadata?.attempt === "number"
            ? (message.metadata.attempt as number)
            : null,
        metadata: message.metadata,
        safeguards: acceptedSafeguardEntries.length ? acceptedSafeguardEntries : undefined,
      });
    },
    [acceptedSafeguardEntries, approvalFlow, objectiveId],
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

  useEffect(() => {
    void syncCopilotSession(artifacts, objectiveId ?? null);
  }, [artifacts, objectiveId, syncCopilotSession]);

  const handleIntakeAccept = useCallback(
    async ({
      missionId,
      objective,
      audience,
      guardrailSummary,
      kpis,
      confidence,
    }: AcceptedIntakePayload) => {
      setObjectiveId(missionId);

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

      setMissionBrief({
        missionId,
        objective: normalizedObjective,
        audience: normalizedAudience,
        kpis: normalizedKpis,
        safeguards: acceptedSafeguards,
        confidence: normalizedConfidence,
        source: null,
      });
      setSafeguards((prev) => normalizeSafeguards(acceptedSafeguards, prev));
      setSafeguardHistory([]);
      setSafeguardHistoryOpen(false);
      hasPinnedBriefRef.current = false;

      void telemetryClient.sendTelemetryEvent(tenantId, {
        eventName: "mission_brief_updated",
        missionId,
        eventData: {
          kpi_count: normalizedKpis.length,
          safeguard_count: acceptedSafeguards.length,
        },
      });

      await syncCopilotSession(artifacts, missionId);
    },
    [artifacts, syncCopilotSession, tenantId],
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
            <p className="text-xs uppercase tracking-widest text-violet-300">Gate G-A · Foundation ready</p>
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
        objectiveId={objectiveId ?? null}
        onAccept={handleIntakeAccept}
        onStageAdvance={handleIntakeAdvance}
      />

      <RecommendedToolStrip
        tenantId={tenantId}
        missionId={objectiveId ?? null}
        onAlert={setWorkspaceAlert}
        onStageAdvance={handleToolkitsAdvance}
        onSelectionChange={handleToolkitSelectionChange}
      />

      {showCoverageMeter && (
        <CoverageMeter
          tenantId={tenantId}
          missionId={objectiveId ?? null}
          selectedToolkitsCount={selectedToolkitsCount}
          hasArtifacts={artifacts.length > 0}
          onComplete={handleInspectionComplete}
        />
      )}

      <PlannerInsightRail
        tenantId={tenantId}
        missionId={objectiveId ?? null}
        sessionIdentifier={sessionIdentifier}
        plannerRuns={[]}
        onSelectPlay={handlePlannerSelect}
        onStageAdvance={handlePlanComplete}
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
                missionId={objectiveId ?? null}
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
