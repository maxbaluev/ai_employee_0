const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,}/g;
const TOKEN_PATTERN = /(sk|pk|bearer|api_key|token)[0-9a-z_-]{8,}/gi;

type Redactable = Record<string, unknown> | unknown[] | string | number | boolean | null | undefined;

function sanitizeString(value: string): string {
  let sanitized = value;
  sanitized = sanitized.replace(EMAIL_PATTERN, '[redacted-email]');
  sanitized = sanitized.replace(PHONE_PATTERN, '[redacted-phone]');
  sanitized = sanitized.replace(TOKEN_PATTERN, '[redacted-token]');
  return sanitized;
}

export function redactTelemetryPayload<T extends Redactable>(payload: T): T {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    return sanitizeString(payload) as T;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => redactTelemetryPayload(item)) as T;
  }

  if (typeof payload === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value === null || value === undefined) {
        result[key] = value;
        continue;
      }

      if (typeof value === 'string') {
        result[key] = sanitizeString(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value;
      } else {
        result[key] = redactTelemetryPayload(value as Redactable);
      }
    }
    return result as T;
  }

  return payload;
}

export function redactTelemetryEvent(payload: Record<string, unknown> = {}): Record<string, unknown> {
  const safePayload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (typeof value === 'string') {
      safePayload[key] = sanitizeString(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      safePayload[key] = value;
    } else {
      safePayload[key] = redactTelemetryPayload(value as Redactable);
    }
  }

  return safePayload;
}
