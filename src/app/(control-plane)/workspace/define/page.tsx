"use client";

import { useState } from "react";

import {
  ChipEditor,
  CopilotChatRail,
  LockBriefModal,
  MissionIntakeForm,
  SafeguardChecklist,
} from "@/components/workspace/define";
import type { ConfidenceWithLevel, MissionBrief } from "@/hooks/useMissionIntake";
import { useMissionIntake } from "@/hooks/useMissionIntake";

export default function DefineStage() {
  const {
    state,
    setIntent,
    resetGenerationError,
    generateBrief,
    updateChip,
    addSafeguard,
    removeSafeguard,
    toggleSafeguard,
    lockBrief,
    confidencesWithLevel,
    hasBrief,
  } = useMissionIntake();

  const [showLockModal, setShowLockModal] = useState(false);

  const chipConfidences = confidencesWithLevel as Record<keyof MissionBrief, ConfidenceWithLevel | undefined>;

  const openLockDialog = () => {
    if (!hasBrief || state.status === "loading") {
      return;
    }
    setShowLockModal(true);
  };

  const confirmLockBrief = () => {
    lockBrief();
    setShowLockModal(false);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <div className="space-y-6">
        <MissionIntakeForm
          intent={state.intent}
          status={state.status}
          error={state.error}
          lastUpdated={state.lastUpdated}
          onIntentChange={setIntent}
          onSubmit={generateBrief}
          onDismissError={resetGenerationError}
        />

        <ChipEditor
          brief={state.brief}
          confidences={chipConfidences}
          status={state.status}
          locked={state.locked}
          onChipUpdate={updateChip}
        />

        <SafeguardChecklist
          safeguards={state.safeguards}
          onAdd={addSafeguard}
          onRemove={removeSafeguard}
          onToggle={toggleSafeguard}
          disabled={state.locked}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-200">Ready to lock the brief?</p>
            <p className="text-xs text-slate-500">
              Locking freezes Stage 1, emits telemetry, and signals the Prepare stage to fetch tool readiness.
            </p>
          </div>
          <button
            type="button"
            onClick={openLockDialog}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasBrief || state.status === "loading" || state.locked}
          >
            {state.locked ? "Brief locked" : "Lock brief"}
          </button>
        </div>
      </div>

      <CopilotChatRail messages={state.messages} status={state.status} />

      <LockBriefModal
        open={showLockModal}
        brief={state.brief}
        safeguards={state.safeguards}
        onConfirm={confirmLockBrief}
        onClose={() => setShowLockModal(false)}
      />
    </div>
  );
}
