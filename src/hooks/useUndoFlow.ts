"use client";

import { useCallback, useState } from 'react';

import { sendTelemetryEvent } from '@/lib/telemetry/client';

export type UndoRequestPayload = {
  toolCallId: string;
  missionId?: string | null;
  reason?: string;
  undoToken?: string | null;
};

export type UndoResult =
  | { ok: true; status: 'completed' | 'queued'; message?: string }
  | { ok: false; error: string };

type UseUndoFlowOptions = {
  tenantId: string;
  missionId?: string | null;
  onCompleted?: (status: 'completed' | 'queued') => void;
};

export function useUndoFlow(options: UseUndoFlowOptions) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestUndo = useCallback(
    async ({ toolCallId, missionId, reason, undoToken }: UndoRequestPayload): Promise<UndoResult> => {
      if (!toolCallId) {
        const message = 'Missing tool call identifier.';
        setError(message);
        return { ok: false, error: message };
      }

      const resolvedMissionId = missionId ?? options.missionId ?? null;

      setIsRequesting(true);
      setError(null);

      try {
        await sendTelemetryEvent(options.tenantId, {
          eventName: 'undo_requested',
          missionId: resolvedMissionId ?? undefined,
          eventData: {
            tool_call_id: toolCallId,
            reason: reason ?? null,
            undo_token: undoToken ?? null,
          },
        });

        const response = await fetch('/api/undo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: options.tenantId,
            missionId: resolvedMissionId ?? undefined,
            toolCallId,
            reason,
            undoToken: undoToken ?? undefined,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const message = payload.error ?? 'Undo request failed';
          setError(message);
          return { ok: false, error: message };
        }

        const body = (await response.json()) as {
          status?: 'completed' | 'queued';
          message?: string;
        };

        const status = body.status ?? 'queued';
        options.onCompleted?.(status);

        return { ok: true, status, message: body.message };
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : 'Unexpected undo failure';
        setError(message);
        return { ok: false, error: message };
      } finally {
        setIsRequesting(false);
      }
    },
    [options],
  );

  return {
    isRequesting,
    error,
    requestUndo,
    clearError: () => setError(null),
  } as const;
}
