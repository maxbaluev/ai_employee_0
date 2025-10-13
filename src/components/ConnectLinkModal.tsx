"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ConnectLinkModalProps = {
  isOpen: boolean;
  tenantId: string;
  missionId?: string | null;
  toolkit: {
    slug: string;
    name: string;
    description?: string;
    category?: string;
    authSchemes?: string[];
  } | null;
  onClose: () => void;
  onStatusChange?: (details: { toolkitSlug: string; status: string }) => void;
  onLaunched?: (details: { toolkitSlug: string; state: string }) => void;
  onLinked?: (details: { toolkitSlug: string; connectionId?: string | null }) => void;
  onError?: (details: { toolkitSlug: string; status: string; message: string }) => void;
};

type ConnectionStatus = "idle" | "pending" | "linked" | "failed" | "timeout" | "error";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120_000;

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [];
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    'input:not([type="hidden"]):not([disabled])',
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ];
  return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(",")));
}

export function ConnectLinkModal({
  isOpen,
  tenantId,
  missionId = null,
  toolkit,
  onClose,
  onStatusChange,
  onLaunched,
  onLinked,
  onError,
}: ConnectLinkModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const pollDeadlineRef = useRef<number>(0);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);
  const [stateToken, setStateToken] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const oauthRedirectUri = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    try {
      const url = new URL(window.location.origin);
      url.pathname = "/api/composio/connect";
      url.search = "";
      return url.toString();
    } catch (error) {
      console.warn("[ConnectLinkModal] Failed to compute redirect URI", error);
      return "";
    }
  }, []);

  const toolkitSlug = toolkit?.slug ?? null;

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement;
      setConnectionStatus("idle");
      setStatusMessage(null);
      setAuthorizationUrl(null);
      setStateToken(null);
      setCopyState("idle");

      requestAnimationFrame(() => {
        const focusable = getFocusableElements(dialogRef.current);
        focusable[0]?.focus();
      });
    } else {
      clearPolling();
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus({ preventScroll: true });
      }
    }
  }, [clearPolling, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab") {
        const focusable = getFocusableElements(dialogRef.current);
        if (!focusable.length) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const notifyStatusChange = useCallback(
    (status: ConnectionStatus) => {
      if (toolkitSlug) {
        onStatusChange?.({ toolkitSlug, status });
      }
    },
    [onStatusChange, toolkitSlug],
  );

  const pollStatus = useCallback(async () => {
    if (!toolkitSlug) {
      return;
    }

    try {
      const params = new URLSearchParams({ tenantId, toolkit: toolkitSlug });
      if (missionId) {
        params.set("missionId", missionId);
      }

      const response = await fetch(`/api/toolkits/connections?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Status poll failed with ${response.status}`);
      }

      const data = (await response.json()) as {
        connections?: Array<{
          toolkit?: string;
          status?: string;
          connectionId?: string | null;
        }>;
      };

      const latest = data.connections?.find((row) => row?.toolkit === toolkitSlug) ?? null;

      if (!latest) {
        if (Date.now() > pollDeadlineRef.current) {
          clearPolling();
          setConnectionStatus("timeout");
          setStatusMessage(
            "Waiting for Connect Link confirmation timed out. Close this modal to retry after completing the OAuth flow.",
          );
          notifyStatusChange("timeout");
        }
        return;
      }

      const status = (latest.status ?? "").toLowerCase();

      if (status === "linked") {
        clearPolling();
        setConnectionStatus("linked");
        setStatusMessage("Connect Link is linked. You can close this window.");
        notifyStatusChange("linked");
        onLinked?.({ toolkitSlug, connectionId: latest.connectionId ?? null });
      } else if (status === "failed" || status === "revoked") {
        clearPolling();
        setConnectionStatus("failed");
        const message =
          status === "revoked"
            ? "The connection was revoked from Composio. Retry the Connect Link flow."
            : "Composio reported a failure while linking this toolkit. Retry or use the shareable link.";
        setStatusMessage(message);
        notifyStatusChange("failed");
        onError?.({ toolkitSlug, status, message });
      } else if (status === "pending" || status === "not_linked") {
        setConnectionStatus("pending");
        setStatusMessage("Waiting for you to finish the Connect Link authorization in the new tab...");
        notifyStatusChange("pending");
      }
    } catch (error) {
      clearPolling();
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected error while checking Connect Link status";
      setConnectionStatus("error");
      setStatusMessage(message);
      notifyStatusChange("error");
      if (toolkitSlug) {
        onError?.({ toolkitSlug, status: "error", message });
      }
    }
  }, [clearPolling, missionId, notifyStatusChange, onError, onLinked, tenantId, toolkitSlug]);

  const startPolling = useCallback(() => {
    if (!toolkitSlug) {
      return;
    }

    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
    clearPolling();

    pollIntervalRef.current = window.setInterval(() => {
      void pollStatus();
    }, POLL_INTERVAL_MS);

    void pollStatus();
  }, [clearPolling, pollStatus, toolkitSlug]);

  const launchConnectLink = useCallback(async () => {
    if (!toolkitSlug || !toolkit) {
      return;
    }

    setIsLaunching(true);
    setConnectionStatus("pending");
    setStatusMessage("Opening Composio Connect Link in a new tab...");
    notifyStatusChange("pending");

    try {
      const response = await fetch("/api/composio/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "init",
          tenantId,
          missionId,
          provider: "composio",
          redirectUri: oauthRedirectUri,
          toolkitSlug,
          scopes: toolkit.authSchemes?.length ? toolkit.authSchemes : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate Connect Link OAuth flow");
      }

      const data = (await response.json()) as {
        authorizationUrl?: string;
        state?: string;
      };

      const launchUrl = data.authorizationUrl ?? null;
      setAuthorizationUrl(launchUrl);
      setStateToken(data.state ?? null);

      if (launchUrl) {
        window.open(launchUrl, "_blank", "noopener");
      }

      if (toolkitSlug && data.state) {
        onLaunched?.({ toolkitSlug, state: data.state });
      }

      startPolling();
    } catch (error) {
      clearPolling();
      const message =
        error instanceof Error
          ? error.message
          : "Unexpected error while launching Connect Link";
      setConnectionStatus("error");
      setStatusMessage(message);
      notifyStatusChange("error");
      if (toolkitSlug) {
        onError?.({ toolkitSlug, status: "error", message });
      }
    } finally {
      setIsLaunching(false);
    }
  }, [
    clearPolling,
    missionId,
    notifyStatusChange,
    oauthRedirectUri,
    onError,
    onLaunched,
    startPolling,
    tenantId,
    toolkit,
    toolkitSlug,
  ]);

  const handleCopyLink = useCallback(async () => {
    if (!authorizationUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(authorizationUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      console.warn("[ConnectLinkModal] failed to copy connect link", error);
    }
  }, [authorizationUrl]);

  const showModal = isOpen && toolkit;

  if (!showModal) {
    return null;
  }

  const authModeLabel = toolkit.authSchemes?.length ? toolkit.authSchemes.join(", ") : "OAuth";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-10">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-link-heading"
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 id="connect-link-heading" className="text-lg font-semibold text-white">
              Connect {toolkit.name}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Launch the Composio Connect Link flow to authorise {toolkit.name}. We request the required
              scopes ({authModeLabel}) defined in the Composio docs ({'`connectedAccounts.link`'} workflow).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearPolling();
              onClose();
            }}
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 transition hover:border-white/30 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-200">
            <p className="text-sm text-slate-200">Here is what to expect:</p>
            <ol className="mt-3 space-y-2 text-xs text-slate-300">
              <li>1. A new tab opens on Composio to authenticate your account.</li>
              <li>2. Approve the requested scopes so the AI Control Plane can orchestrate {toolkit.name}.</li>
              <li>3. Return to this modal; we automatically detect when the connection is linked.</li>
            </ol>
          </div>

          {toolkit.description && (
            <p className="mt-4 text-xs text-slate-400">{toolkit.description}</p>
          )}

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <button
              type="button"
              onClick={launchConnectLink}
              disabled={isLaunching}
              className="inline-flex items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLaunching ? "Launching…" : "Launch Connect Link"}
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!authorizationUrl}
              className="inline-flex items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copyState === "copied" ? "Copied!" : "Copy shareable link"}
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Status</span>
              <span
                className={
                  connectionStatus === "linked"
                    ? "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"
                    : connectionStatus === "pending"
                      ? "rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
                      : connectionStatus === "failed" || connectionStatus === "error"
                        ? "rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300"
                        : connectionStatus === "timeout"
                          ? "rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300"
                          : "rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300"
                }
              >
                {connectionStatus === "idle"
                  ? "Not started"
                  : connectionStatus === "pending"
                    ? "Pending"
                    : connectionStatus === "linked"
                      ? "Linked"
                      : connectionStatus === "failed"
                        ? "Failed"
                        : connectionStatus === "timeout"
                          ? "Timed out"
                          : "Error"}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {statusMessage ?? "Launch the Connect Link flow to begin authorising this toolkit."}
            </p>
            {stateToken && (
              <p className="mt-4 text-[10px] text-slate-500">
                OAuth state token: <span className="font-mono">{stateToken}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
