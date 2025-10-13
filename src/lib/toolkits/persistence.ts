export type ToolkitSelectionDetail = {
  slug: string;
  name: string;
  category: string;
  authMode: string;
  noAuth: boolean;
  undoToken?: string | null;
  connectionStatus?: string;
};

const STORAGE_PREFIX = 'control-plane-toolkit-selections';

function resolveStorageKey(tenantId: string | null | undefined, missionId: string | null | undefined) {
  if (!tenantId || !missionId) {
    return null;
  }
  return `${STORAGE_PREFIX}:${tenantId}:${missionId}`;
}

export function persistToolkitSelections(
  tenantId: string | null | undefined,
  missionId: string | null | undefined,
  selections: ToolkitSelectionDetail[],
) {
  const key = resolveStorageKey(tenantId, missionId);
  if (!key || typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(selections));
  } catch (error) {
    console.warn('[toolkits:persistence] failed to persist selections', error);
  }
}

export function loadToolkitSelections(
  tenantId: string | null | undefined,
  missionId: string | null | undefined,
): ToolkitSelectionDetail[] | null {
  const key = resolveStorageKey(tenantId, missionId);
  if (!key || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const payload = JSON.parse(raw) as ToolkitSelectionDetail[];
    if (!Array.isArray(payload)) {
      return null;
    }
    return payload.filter((item) => typeof item?.slug === 'string');
  } catch (error) {
    console.warn('[toolkits:persistence] failed to load selections', error);
    return null;
  }
}

export function clearToolkitSelections(
  tenantId: string | null | undefined,
  missionId: string | null | undefined,
) {
  const key = resolveStorageKey(tenantId, missionId);
  if (!key || typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch (error) {
    console.warn('[toolkits:persistence] failed to clear selections', error);
  }
}
