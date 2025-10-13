type RawSafeguardHint = {
  hintType: string | null;
  text: string;
};

export type SafeguardNormalizationInput = RawSafeguardHint;

export type SafeguardNormalizationFactory<T> = (input: {
  id: string;
  hint: RawSafeguardHint;
}) => T;

const HASH_OFFSET = 5;

const defaultFactory = <T extends {
  id: string;
  label: string;
  hintType: string;
  status: string;
  confidence: number | null;
  pinned: boolean;
  rationale: string | null;
  lastUpdatedAt: string | null;
}>(input: { id: string; hint: RawSafeguardHint }): T => {
  const { id, hint } = input;

  return {
    id,
    label: hint.text,
    hintType: hint.hintType ?? "unspecified",
    status: "accepted",
    confidence: null,
    pinned: false,
    rationale: null,
    lastUpdatedAt: null,
  } as T;
};

export function hashSafeguardText(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << HASH_OFFSET) - hash + value.charCodeAt(index);
    hash |= 0; // eslint-disable-line no-bitwise -- intentional hash compaction
  }

  return Math.abs(hash).toString(36);
}

export function buildSafeguardId(hint: RawSafeguardHint, occurrence: number): string {
  const type = hint.hintType ?? "hint";
  return `${type}-${hashSafeguardText(hint.text)}-${occurrence}`;
}

export function normalizeSafeguards<T extends { id: string }>(
  hints: RawSafeguardHint[],
  previous: T[],
  factory: SafeguardNormalizationFactory<T> = defaultFactory,
): T[] {
  const previousById = new Map(previous.map((hint) => [hint.id, hint] as const));
  const seenOccurrences: Record<string, number> = {};

  return hints.map((hint) => {
    const occurrenceKey = `${hint.hintType ?? "hint"}|${hint.text}`;
    const occurrence = seenOccurrences[occurrenceKey] ?? 0;
    seenOccurrences[occurrenceKey] = occurrence + 1;

    const id = buildSafeguardId(hint, occurrence);
    const existing = previousById.get(id);

    if (existing) {
      return existing;
    }

    return factory({ id, hint });
  });
}

