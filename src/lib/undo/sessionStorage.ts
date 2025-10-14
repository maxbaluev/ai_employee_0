export type StoredUndoBanner = {
  toolCallId: string;
  summary: string | null;
  riskTags: string[];
  expiresAt: number;
  undoToken: string | null;
  overrideAllowed: boolean;
  overrideUrl: string | null;
};

const STORAGE_PREFIX = "gate_gb_undo_banner";

function buildKey(tenantId: string, missionId: string | null) {
  const missionKey = missionId && missionId.length ? missionId : "none";
  return `${STORAGE_PREFIX}:${tenantId}:${missionKey}`;
}

export function saveUndoBanner(
  tenantId: string,
  missionId: string | null,
  banner: StoredUndoBanner,
) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(buildKey(tenantId, missionId), JSON.stringify(banner));
  } catch (error) {
    console.warn("[UndoStorage] failed to persist banner", error);
  }
}

export function loadUndoBanner(
  tenantId: string,
  missionId: string | null,
): StoredUndoBanner | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(buildKey(tenantId, missionId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredUndoBanner>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.toolCallId !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      clearUndoBanner(tenantId, missionId);
      return null;
    }
    return {
      toolCallId: parsed.toolCallId,
      summary: typeof parsed.summary === "string" || parsed.summary === null ? parsed.summary ?? null : null,
      riskTags: Array.isArray(parsed.riskTags)
        ? parsed.riskTags.filter((tag): tag is string => typeof tag === "string")
        : [],
      expiresAt: parsed.expiresAt,
      undoToken: typeof parsed.undoToken === "string" ? parsed.undoToken : null,
      overrideAllowed: parsed.overrideAllowed === true,
      overrideUrl: typeof parsed.overrideUrl === "string" ? parsed.overrideUrl : null,
    } satisfies StoredUndoBanner;
  } catch (error) {
    console.warn("[UndoStorage] failed to load banner", error);
    return null;
  }
}

export function clearUndoBanner(tenantId: string, missionId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.removeItem(buildKey(tenantId, missionId));
  } catch (error) {
    console.warn("[UndoStorage] failed to clear banner", error);
  }
}

