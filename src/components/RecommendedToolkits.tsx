"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCopilotReadable } from "@copilotkit/react-core";

import { sendTelemetryEvent } from "@/lib/telemetry/client";
import {
  loadToolkitSelections,
  persistToolkitSelections,
  type ToolkitSelectionDetail,
} from "@/lib/toolkits/persistence";

type ToolkitMetadata = {
  name: string;
  slug: string;
  description: string;
  category: string;
  no_auth: boolean;
  auth_schemes: string[];
  logo?: string | null;
};

type ToolkitSelection = {
  slug: string;
  name: string;
  authType: string;
  category: string;
  logo?: string | null;
  noAuth: boolean;
};

type RecommendedToolkitsProps = {
  tenantId: string;
  missionId: string | null;
  onAlert?: (alert: { tone: "success" | "error" | "info"; message: string }) => void;
  onStageAdvance?: () => void;
  onSelectionChange?: (count: number) => void;
};

export function RecommendedToolkits({ tenantId, missionId, onAlert, onStageAdvance, onSelectionChange }: RecommendedToolkitsProps) {
  const [toolkits, setToolkits] = useState<ToolkitMetadata[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [selectionDetails, setSelectionDetails] = useState<ToolkitSelectionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toolkitButtonRefs = useRef<HTMLButtonElement[]>([]);
  const toolkitsRef = useRef<ToolkitMetadata[]>([]);
  const persistedLoadedRef = useRef(false);

  useEffect(() => {
    toolkitButtonRefs.current = [];
  }, [toolkits]);

  useEffect(() => {
    toolkitsRef.current = toolkits;
  }, [toolkits]);

  const buildSelectionDetail = useCallback(
    (slug: string): ToolkitSelectionDetail | null => {
      const existing = selectionDetails.find((item) => item.slug === slug);
      if (existing) {
        return existing;
      }

      const toolkit = toolkitsRef.current.find((candidate) => candidate.slug === slug);
      if (!toolkit) {
        return null;
      }

      return {
        slug,
        name: toolkit.name,
        category: toolkit.category,
        authMode: toolkit.no_auth ? "none" : toolkit.auth_schemes[0] ?? "oauth",
        noAuth: toolkit.no_auth,
        connectionStatus: toolkit.no_auth ? "not_required" : "not_linked",
        undoToken: null,
      };
    },
    [selectionDetails],
  );

  const syncSelectionState = useCallback(
    (
      selections: Array<{
        slug: string;
        name?: string;
        category?: string;
        authMode?: string | null;
        noAuth?: boolean;
        undoToken?: string | null;
        connectionStatus?: string | null;
      }>,
    ) => {
      const detailList: ToolkitSelectionDetail[] = selections
        .map((selection) => {
          const toolkit = toolkitsRef.current.find((item) => item.slug === selection.slug);
          const name = selection.name ?? toolkit?.name ?? selection.slug;
          const category = selection.category ?? toolkit?.category ?? "general";
          const noAuth = typeof selection.noAuth === "boolean" ? selection.noAuth : Boolean(toolkit?.no_auth);
          const authMode = selection.authMode ?? (noAuth ? "none" : toolkit?.auth_schemes[0] ?? "oauth");
          return {
            slug: selection.slug,
            name,
            category,
            authMode,
            noAuth,
            connectionStatus: selection.connectionStatus ?? (noAuth ? "not_required" : "not_linked"),
            undoToken: selection.undoToken ?? null,
          } satisfies ToolkitSelectionDetail;
        })
        .filter((detail) => detail.slug.length > 0);

      setSelectionDetails(detailList);
      setSelectedSlugs(new Set(detailList.map((detail) => detail.slug)));
      onSelectionChange?.(detailList.length);
    },
    [onSelectionChange],
  );

  useEffect(() => {
    if (!tenantId || !missionId || persistedLoadedRef.current) {
      return;
    }
    const persisted = loadToolkitSelections(tenantId, missionId);
    if (persisted && persisted.length > 0) {
      syncSelectionState(persisted);
    }
    persistedLoadedRef.current = true;
  }, [missionId, syncSelectionState, tenantId]);

  useEffect(() => {
    persistToolkitSelections(tenantId, missionId, selectionDetails);
  }, [missionId, selectionDetails, tenantId]);

  const fetchToolkits = useCallback(async () => {
    if (!tenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ tenantId });
      if (missionId) {
        params.append("missionId", missionId);
      }

      const response = await fetch(`/api/toolkits?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch toolkits");
      }

      const data = await response.json();
      const fetchedToolkits = (data.toolkits || []) as ToolkitMetadata[];
      setToolkits(fetchedToolkits);

      const selectionPayload: Array<{
        slug: string;
        name?: string;
        category?: string;
        authMode?: string | null;
        noAuth?: boolean;
        undoToken?: string | null;
        connectionStatus?: string | null;
      }> = Array.isArray(data.selectionDetails)
        ? data.selectionDetails
        : Array.isArray(data.selected)
          ? (data.selected as string[]).map((slug) => ({ slug }))
          : [];

      syncSelectionState(selectionPayload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load toolkits";
      setError(message);
      onAlert?.({ tone: "error", message });
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, missionId, onAlert, syncSelectionState]);

  useEffect(() => {
    void fetchToolkits();
  }, [fetchToolkits]);

  useCopilotReadable({
    description: "Gate G-B toolkit selections",
    value: {
      missionId: missionId ?? null,
      tenantId,
      selections: selectionDetails,
    },
  });

  const toggleSelection = (slug: string) => {
    setSelectedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      onSelectionChange?.(next.size);
      return next;
    });

    setSelectionDetails((prev) => {
      const exists = prev.find((detail) => detail.slug === slug);
      if (exists) {
        return prev.filter((detail) => detail.slug !== slug);
      }
      const detail = buildSelectionDetail(slug);
      if (!detail) {
        return prev;
      }
      return [...prev, detail];
    });
  };

  const focusToolkitByIndex = useCallback((index: number) => {
    const buttons = toolkitButtonRefs.current;
    if (!buttons.length) {
      return;
    }
    const normalised = (index + buttons.length) % buttons.length;
    buttons[normalised]?.focus();
  }, []);

  const handleToolkitKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, slug: string, index: number) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 1 : -1;
        focusToolkitByIndex(index + delta);
        return;
      }

      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        toggleSelection(slug);
      }
    },
    [focusToolkitByIndex, toggleSelection],
  );

  const handleSave = async () => {
    if (!missionId) {
      onAlert?.({
        tone: "error",
        message: "Cannot save toolkit selections: mission not accepted",
      });
      return;
    }

    if (selectedSlugs.size === 0) {
      onAlert?.({
        tone: "error",
        message: "Select at least one toolkit to continue.",
      });
      return;
    }

    setIsSaving(true);

    try {
      const selections: ToolkitSelection[] = toolkits
        .filter((tk) => selectedSlugs.has(tk.slug))
        .map((tk) => ({
          slug: tk.slug,
          name: tk.name,
          authType: tk.no_auth ? "none" : tk.auth_schemes[0] || "oauth",
          category: tk.category,
          logo: tk.logo,
          noAuth: tk.no_auth,
        }));

      const response = await fetch("/api/toolkits/selections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId,
          tenantId,
          selections,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save selections");
      }

      const payload = (await response.json().catch(() => null)) as
        | {
            selections?: Array<{
              toolkitId: string;
              metadata?: Record<string, unknown> | null;
              authMode?: string | null;
              undoToken?: string | null;
              connectionStatus?: string | null;
            }>;
          }
        | null;

      void sendTelemetryEvent(tenantId, {
        eventName: "toolkit_selected",
        missionId,
        eventData: {
          selected_count: selections.length,
          selection_slugs: selections.map((sel) => sel.slug),
        },
      });

      onAlert?.({
        tone: "success",
        message: `Saved ${selections.length} toolkit recommendation(s)`,
      });

      if (payload?.selections) {
        const detailList: ToolkitSelectionDetail[] = payload.selections.map((row) => {
          const toolkit = toolkits.find((item) => item.slug === row.toolkitId);
          const metadata = (row.metadata ?? {}) as Record<string, unknown>;
          const name = typeof metadata.name === "string" ? metadata.name : toolkit?.name ?? row.toolkitId;
          const category = typeof metadata.category === "string" ? metadata.category : toolkit?.category ?? "general";
          const noAuth = typeof metadata.noAuth === "boolean" ? metadata.noAuth : Boolean(toolkit?.no_auth);
          const authMode = row.authMode ?? (noAuth ? "none" : toolkit?.auth_schemes[0] ?? "oauth");
          return {
            slug: row.toolkitId,
            name,
            category,
            authMode,
            noAuth,
            connectionStatus: row.connectionStatus ?? (noAuth ? "not_required" : "not_linked"),
            undoToken: row.undoToken ?? null,
          } satisfies ToolkitSelectionDetail;
        });
        setSelectionDetails(detailList);
        setSelectedSlugs(new Set(detailList.map((detail) => detail.slug)));
        persistToolkitSelections(tenantId, missionId, detailList);
      }

      // Notify stage advancement after successful save
      onStageAdvance?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save selections";
      onAlert?.({ tone: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

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
      console.warn("[RecommendedToolkits] Failed to compute redirect URI", error);
      return "";
    }
  }, []);

  const handleConnect = useCallback(
    async (toolkit: ToolkitMetadata) => {
      if (!tenantId) {
        onAlert?.({
          tone: "error",
          message: "Missing tenant context for OAuth connect.",
        });
        return;
      }

      if (!missionId) {
        onAlert?.({
          tone: "error",
          message: "Accept the mission before connecting toolkits.",
        });
        return;
      }

      if (!oauthRedirectUri) {
        onAlert?.({
          tone: "error",
          message: "Unable to resolve OAuth redirect URI.",
        });
        return;
      }

      setConnectError(null);
      setConnectingSlug(toolkit.slug);

      const requestBody = {
        mode: "init" as const,
        tenantId,
        missionId,
        provider: "composio",
        redirectUri: oauthRedirectUri,
        scopes: ["connections:read"],
      };

      try {
        const response = await fetch("/api/composio/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error("Failed to initiate Composio connect link");
        }

        const data = await response.json();
        const authorizationUrl: string | undefined = data.authorizationUrl ?? data.authUrl;

        void sendTelemetryEvent(tenantId, {
          eventName: "oauth_initiated",
          missionId,
          eventData: {
            provider: "composio",
            toolkit_slug: toolkit.slug,
            scopes_requested: requestBody.scopes,
          },
        });

        if (authorizationUrl) {
          window.open(authorizationUrl, "_blank", "noopener");
        }

        onAlert?.({
          tone: "info",
          message: `Launching ${toolkit.name} Connect Link...`,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to launch Composio connect flow";
        setConnectError(message);
        onAlert?.({ tone: "error", message });
      } finally {
        setConnectingSlug(null);
      }
    },
    [missionId, oauthRedirectUri, onAlert, tenantId],
  );

  if (isLoading) {
    return (
      <section className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recommended Tools</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="min-w-[280px] rounded-xl border border-white/10 bg-slate-900/80 p-4 animate-pulse"
            >
              <div className="h-4 w-3/4 bg-white/10 rounded mb-3" />
              <div className="h-3 w-full bg-white/10 rounded mb-2" />
              <div className="h-3 w-2/3 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="border-b border-white/10 px-6 py-6">
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      </section>
    );
  }

  if (toolkits.length === 0) {
    return null;
  }

  return (
    <section className="border-b border-white/10 px-6 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Recommended Tools</h2>
          <p className="text-xs text-slate-400 mt-1">
            Select toolkits to use before planner execution
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!missionId || isSaving}
          className="inline-flex items-center gap-2 rounded-md border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-200 transition enabled:hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Saving..." : `Save (${selectedSlugs.size})`}
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
        {toolkits.slice(0, 20).map((toolkit, index) => {
          const isSelected = selectedSlugs.has(toolkit.slug);
          const requiresOAuth = !toolkit.no_auth;
          const authBadge = toolkit.no_auth ? (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
              No Auth
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
              OAuth
            </span>
          );

          return (
            <article
              key={toolkit.slug}
              className={`group min-w-[280px] rounded-xl border p-4 transition ${
                isSelected
                  ? "border-violet-500/60 bg-violet-500/10"
                  : "border-white/10 bg-slate-900/80 hover:border-white/20 hover:bg-slate-900"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleSelection(toolkit.slug)}
                onKeyDown={(event) => handleToolkitKeyDown(event, toolkit.slug, index)}
                ref={(element) => {
                  if (element) {
                    toolkitButtonRefs.current[index] = element;
                  }
                }}
                data-testid={`toolkit-toggle-${toolkit.slug}`}
                className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {toolkit.logo && (
                      <Image
                        src={toolkit.logo}
                        alt={toolkit.name}
                        width={20}
                        height={20}
                        className="h-5 w-5 rounded object-contain"
                      />
                    )}
                    <h3 className="text-sm font-semibold text-white">{toolkit.name}</h3>
                  </div>
                  {authBadge}
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 mb-3">
                  {toolkit.description || "No description available"}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {toolkit.category}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? "text-violet-300" : "text-slate-400 group-hover:text-slate-300"
                    }`}
                  >
                    {isSelected ? "✓ Selected" : "Select"}
                  </span>
                </div>
              </button>

              {requiresOAuth && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-label={`Connect ${toolkit.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleConnect(toolkit);
                    }}
                    disabled={connectingSlug === toolkit.slug}
                    className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-200 transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-amber-500/20"
                  >
                    {connectingSlug === toolkit.slug ? "Connecting..." : "Connect"}
                  </button>

                  <span className="text-[10px] text-slate-500">
                    {connectingSlug === toolkit.slug ? "Waiting for OAuth" : "Auth required"}
                  </span>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {connectError && (
        <p className="mt-3 text-xs text-red-300">{connectError}</p>
      )}

      {!missionId && (
        <p className="mt-3 text-xs text-amber-300">
          Accept the mission intake above to enable saving toolkit selections.
        </p>
      )}
    </section>
  );
}
