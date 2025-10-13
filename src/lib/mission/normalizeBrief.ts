export type MissionMetadataRowLike = {
  field: string;
  value: unknown;
  confidence: number | null;
};

export type MissionSafeguardRowLike = {
  hint_type: string | null;
  suggested_value: unknown;
  status?: string | null;
};

export type NormalizedMissionBrief = {
  objective: string;
  audience: string;
  kpis: Array<{ label: string; target?: string | null }>;
  safeguards: Array<{ hintType: string; text: string }>;
  confidence: Record<string, number | null>;
};

const KPI_ITEMS_KEY = "items";

export function normalizeMissionBrief(
  metadataRows: MissionMetadataRowLike[],
  safeguardRows: MissionSafeguardRowLike[],
): NormalizedMissionBrief {
  const confidence: Record<string, number | null> = {};
  let objective = "";
  let audience = "";
  const kpis: Array<{ label: string; target?: string | null }> = [];

  for (const row of metadataRows) {
    confidence[row.field] = row.confidence ?? null;

    if (row.field === "objective") {
      const text = extractTextField(row.value);
      if (text) {
        objective = text;
        continue;
      }
    }

    if (row.field === "audience") {
      const text = extractTextField(row.value);
      if (text) {
        audience = text;
        continue;
      }
    }

    if (row.field === "kpis") {
      const items = extractKpiItems(row.value);
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const label = "label" in item && typeof item.label === "string" ? item.label : undefined;
          if (!label) continue;
          const target = "target" in item && typeof item.target === "string" ? item.target : undefined;
          kpis.push({ label, target: target ?? null });
        }
      }
    }
  }

  const safeguards = safeguardRows
    .filter((row) => !row.status || row.status === "accepted")
    .map((row) => {
      const text = extractTextField(row.suggested_value);
      if (!text) return null;
      const hintType = row.hint_type ?? "unspecified";
      return { hintType, text };
    })
    .filter((entry): entry is { hintType: string; text: string } => Boolean(entry));

  return {
    objective,
    audience,
    kpis,
    safeguards,
    confidence,
  };
}

function extractTextField(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if ("text" in value && typeof (value as { text?: unknown }).text === "string") {
    return (value as { text?: string }).text ?? null;
  }

  return null;
}

function extractKpiItems(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (KPI_ITEMS_KEY in value) {
    return (value as Record<string, unknown>)[KPI_ITEMS_KEY];
  }

  return undefined;
}
