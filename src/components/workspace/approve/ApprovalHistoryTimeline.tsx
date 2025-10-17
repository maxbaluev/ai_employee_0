"use client";

import { useState } from "react";

import type { ApprovalComment, ApprovalHistoryEntry } from "@/lib/types/mission";

type ApprovalHistoryTimelineProps = {
  history: ApprovalHistoryEntry[];
  comments: ApprovalComment[];
  onAddComment?: (content: string) => Promise<void>;
};

const ACTION_STYLES: Record<ApprovalHistoryEntry["action"], string> = {
  requested: "bg-slate-700 text-slate-300",
  delegated: "bg-amber-500/20 text-amber-300",
  approved: "bg-cyan-500/20 text-cyan-300",
  rejected: "bg-red-500/20 text-red-300",
  commented: "bg-slate-700 text-slate-300",
};

const ACTION_ICONS: Record<ApprovalHistoryEntry["action"], JSX.Element> = {
  requested: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  ),
  delegated: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
    </svg>
  ),
  approved: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  ),
  rejected: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
        clipRule="evenodd"
      />
    </svg>
  ),
  commented: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

export function ApprovalHistoryTimeline({
  history,
  comments,
  onAddComment,
}: ApprovalHistoryTimelineProps) {
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onAddComment || !draft.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onAddComment(draft.trim());
      setDraft("");
    } finally {
      setIsSubmitting(false);
    }
  }

  const timeline = [...history, ...comments.map(commentToHistoryEntry)].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <section
      aria-labelledby="approval-history-heading"
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <h2 id="approval-history-heading" className="mb-6 text-lg font-semibold text-slate-100">
        History &amp; Comments
      </h2>

      {onAddComment && (
        <form onSubmit={handleSubmit} className="mb-6">
          <label htmlFor="approval-comment" className="mb-2 block text-sm font-medium text-slate-300">
            Add a comment
          </label>
          <div className="flex gap-3">
            <textarea
              id="approval-comment"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={isSubmitting}
              placeholder="Share feedback or capture reviewer context…"
              rows={3}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSubmitting || !draft.trim()}
              className="self-end rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </form>
      )}

      <div className="relative">
        <div className="absolute left-5 top-0 h-full w-px bg-slate-800" aria-hidden="true" />

        {timeline.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No activity captured yet.</p>
        ) : (
          <ol className="space-y-6" aria-label="Approval activity">
            {timeline.map((entry) => (
              <li key={entry.id} className="relative flex gap-4">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${ACTION_STYLES[entry.action]}`}
                  aria-hidden="true"
                >
                  {ACTION_ICONS[entry.action]}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-sm font-medium text-slate-200">{entry.actor}</p>
                    <span className="text-xs text-slate-500">{entry.actorRole}</span>
                    <span className="text-xs text-slate-600">•</span>
                    <time dateTime={entry.timestamp} className="text-xs text-slate-500">
                      {new Date(entry.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p className="mt-1 text-sm capitalize text-slate-400">
                    {entry.action.replace("_", " ")}
                  </p>
                  {entry.note && (
                    <p className="mt-2 rounded-lg bg-slate-900/60 p-3 text-sm text-slate-300">
                      {entry.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function commentToHistoryEntry(comment: ApprovalComment): ApprovalHistoryEntry {
  return {
    id: comment.id,
    action: "commented",
    actor: comment.author,
    actorRole: comment.authorRole,
    note: comment.content,
    timestamp: comment.timestamp,
  };
}
