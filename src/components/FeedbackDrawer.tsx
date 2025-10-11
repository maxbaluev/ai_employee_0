"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { MissionStage } from "./mission-stages";
import { sendTelemetryEvent } from "@/lib/telemetry/client";

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
];

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS.join(",")));
}

export type FeedbackDrawerProps = {
  tenantId: string;
  missionId: string | null;
  currentStage: MissionStage;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedRating: number | null;
  onRatingChange: (rating: number | null) => void;
  onSubmit: (payload: { rating: number | null; comment: string }) => Promise<unknown> | unknown;
};

export function FeedbackDrawer({
  tenantId,
  missionId,
  currentStage,
  isOpen,
  onOpenChange,
  selectedRating,
  onRatingChange,
  onSubmit,
}: FeedbackDrawerProps) {
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const spaceKeyDownHandledRef = useRef(false);

  const commentFieldId = useId();
  const titleId = useId();

  const canRenderTrigger =
    currentStage === MissionStage.Evidence || currentStage === MissionStage.Feedback;

  useEffect(() => {
    if (!canRenderTrigger && isOpen) {
      onOpenChange(false);
    }
  }, [canRenderTrigger, isOpen, onOpenChange]);

  useEffect(() => {
    if (isOpen) {
      setSubmissionError(null);
    }

    if (isOpen && !previouslyFocusedRef.current) {
      previouslyFocusedRef.current = triggerRef.current ?? document.activeElement;
    }

    if (!isOpen) {
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus({ preventScroll: true });
      }
      previouslyFocusedRef.current = null;
      return;
    }

    const focusableWithinDrawer = getFocusableElements(drawerRef.current);
    const focusTarget = cancelButtonRef.current ?? focusableWithinDrawer[0];
    const frame = requestAnimationFrame(() => {
      focusTarget?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(drawerRef.current);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !focusable.includes(active as HTMLElement)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onOpenChange]);

  const emitRatingTelemetry = useCallback(
    (rating: number) => {
      void sendTelemetryEvent(tenantId, {
        eventName: "feedback_rating_selected",
        missionId: missionId ?? undefined,
        eventData: {
          rating,
          stage: MissionStage.Evidence,
        },
      });
    },
    [missionId, tenantId],
  );

  const emitCommentTelemetry = useCallback(
    (rating: number | null, commentText: string) => {
      void sendTelemetryEvent(tenantId, {
        eventName: "feedback_comment_submitted",
        missionId: missionId ?? undefined,
        eventData: {
          rating,
          comment: commentText,
          stage: MissionStage.Evidence,
        },
      });
    },
    [missionId, tenantId],
  );

  const handleTriggerActivate = useCallback(() => {
    if (!canRenderTrigger) {
      return;
    }
    previouslyFocusedRef.current = document.activeElement;
    onOpenChange(true);
  }, [canRenderTrigger, onOpenChange]);

  const handleRatingSelect = useCallback(
    (value: number) => {
      onRatingChange(value);
      emitRatingTelemetry(value);
    },
    [emitRatingTelemetry, onRatingChange],
  );

  const handleRatingKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        handleRatingSelect(RATING_OPTIONS[index]);
        return;
      }

      if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
      const nextIndex = (index + direction + RATING_OPTIONS.length) % RATING_OPTIONS.length;
      const nextValue = RATING_OPTIONS[nextIndex];
      handleRatingSelect(nextValue);

      const focusable = drawerRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-rating-option="true"]',
      );
      focusable?.[nextIndex]?.focus();
    },
    [handleRatingSelect],
  );

  const handleCommentChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setComment(event.target.value);
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      const trimmedComment = comment.trim();

      setSubmissionError(null);

      let submissionFailed = false;

      try {
        setIsSubmitting(true);
        await onSubmit({ rating: selectedRating, comment: trimmedComment });
      } catch (error) {
        submissionFailed = true;
        console.error('[FeedbackDrawer] onSubmit failed', error);
        const errorMessage =
          error instanceof Error && error.message
            ? error.message
            : 'We could not submit your feedback. Please try again.';
        setSubmissionError(errorMessage);
      } finally {
        setIsSubmitting(false);
      }

      if (submissionFailed) {
        return;
      }

      emitCommentTelemetry(selectedRating, trimmedComment);
      onRatingChange(null);
      setComment("");
      onOpenChange(false);
    },
    [
      comment,
      emitCommentTelemetry,
      isSubmitting,
      onOpenChange,
      onRatingChange,
      onSubmit,
      selectedRating,
    ],
  );

  const handleOverlayMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === overlayRef.current) {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  const ratingButtons = useMemo(
    () =>
      RATING_OPTIONS.map((value, index) => {
        const isChecked = selectedRating === value;
        const tabIndex = isChecked || (selectedRating == null && index === 0) ? 0 : -1;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isChecked}
            tabIndex={tabIndex}
            data-rating-option="true"
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 ${
              isChecked
                ? 'border-amber-300 bg-amber-200/20 text-amber-200'
                : 'border-white/20 text-white/85 hover:border-white'
            }`}
            onClick={() => handleRatingSelect(value)}
            onKeyDown={(event) => handleRatingKeyDown(event, index)}
          >
            {value}
          </button>
        );
      }),
    [handleRatingKeyDown, handleRatingSelect, selectedRating],
  );

  if (!canRenderTrigger) {
    return null;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-amber-300 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
        onClick={handleTriggerActivate}
        onKeyDown={(event) => {
          const isSpaceKey =
            event.code === "Space" ||
            event.key === " " ||
            event.key === "Space" ||
            event.key === "Spacebar";

          if (event.key === "Enter") {
            event.preventDefault();
            handleTriggerActivate();
            return;
          }

          if (isSpaceKey) {
            event.preventDefault();
            spaceKeyDownHandledRef.current = true;
            handleTriggerActivate();
          }
        }}
        onKeyUp={(event) => {
          const isSpaceKey =
            event.code === "Space" ||
            event.key === " " ||
            event.key === "Space" ||
            event.key === "Spacebar";

          if (isSpaceKey) {
            event.preventDefault();
            if (!spaceKeyDownHandledRef.current) {
              handleTriggerActivate();
            }
            spaceKeyDownHandledRef.current = false;
          }
        }}
      >
        Open Feedback Drawer
      </button>

      {isOpen ? (
        <div
          ref={overlayRef}
          role="presentation"
          className="fixed inset-0 z-40 flex justify-end bg-slate-950/80 backdrop-blur"
          onMouseDown={handleOverlayMouseDown}
        >
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-label="Mission Feedback"
            className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-slate-950/95 px-6 py-8 shadow-[0_0_40px_rgba(0,0,0,0.45)] focus:outline-none"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="mb-6">
              <p className="text-xs uppercase tracking-[0.35em] text-amber-300">Feedback</p>
              <h2 id={titleId} className="mt-2 text-2xl font-semibold text-white">
                Mission Feedback
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Share how well the dry-run outputs met expectations so the agent can iterate smarter.
              </p>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <fieldset>
                <legend className="text-sm font-semibold text-white">
                  Overall rating
                </legend>
                <div
                  role="radiogroup"
                  aria-labelledby={titleId}
                  className="mt-3 flex items-center gap-3"
                >
                  {ratingButtons}
                </div>
              </fieldset>

              <div className="flex flex-col gap-2">
                <label htmlFor={commentFieldId} className="text-sm font-semibold text-white">
                  Additional context
                </label>
                <textarea
                  id={commentFieldId}
                  value={comment}
                  onChange={handleCommentChange}
                  className="min-h-[120px] resize-y rounded-xl border border-white/15 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-white/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  placeholder="Highlight standout artifacts, gaps, or opportunities for the next iteration."
                />
              </div>

              <div className="flex items-center justify-between">
                <button
                  ref={cancelButtonRef}
                  type="button"
                  className="rounded-full border border-white/15 px-4 py-2 text-sm text-white transition hover:border-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-amber-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-white/30"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting…" : "Submit feedback"}
                </button>
              </div>
              {submissionError ? (
                <p
                  role="alert"
                  aria-live="polite"
                  className="text-right text-sm text-rose-300"
                >
                  {submissionError}
                </p>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
