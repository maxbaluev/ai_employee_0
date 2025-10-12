const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_PATTERN = /\+?\d[\d\s().-]{6,}/g;
const TOKEN_PATTERN = /(sk|pk|bearer|api_key|token)[0-9a-z_-]{8,}/gi;

/**
 * Represents a value that has been redacted for telemetry purposes.
 * Primitive types pass through, while strings may be sanitized and
 * arrays/objects are recursively redacted.
 */
export type RedactedValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | RedactedValue[]
  | { [key: string]: RedactedValue };

function sanitizeString(value: string): string {
  let sanitized = value;
  sanitized = sanitized.replace(EMAIL_PATTERN, '[redacted-email]');
  sanitized = sanitized.replace(PHONE_PATTERN, '[redacted-phone]');
  sanitized = sanitized.replace(TOKEN_PATTERN, '[redacted-token]');
  return sanitized;
}

export function redactTelemetryPayload(payload: unknown): RedactedValue {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (typeof payload === 'string') {
    return sanitizeString(payload);
  }

  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => redactTelemetryPayload(item));
  }

  if (typeof payload === 'object') {
    const result: Record<string, RedactedValue> = {};
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
        result[key] = redactTelemetryPayload(value);
      }
    }
    return result;
  }

  return payload as RedactedValue;
}

export function redactTelemetryEvent(payload: unknown): Record<string, RedactedValue> {
  const safePayload: Record<string, RedactedValue> = {};

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return safePayload;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    if (typeof value === 'string') {
      safePayload[key] = sanitizeString(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      safePayload[key] = value;
    } else {
      safePayload[key] = redactTelemetryPayload(value);
    }
  }

  return safePayload;
}
