import type { Session } from '@supabase/supabase-js';

export class TenantResolutionError extends Error {
  status: number;
  hint?: string;

  constructor(message: string, status: number, hint?: string) {
    super(message);
    this.name = 'TenantResolutionError';
    this.status = status;
    this.hint = hint;
  }
}

export interface RequireTenantIdOptions {
  providedTenantId?: unknown;
  session?: Session | null;
  missingTenantHint?: string;
  invalidTenantHint?: string;
}

export function requireTenantId(options: RequireTenantIdOptions): string {
  const {
    providedTenantId,
    session,
    missingTenantHint = 'Authenticate with Supabase or include tenantId in the request body.',
    invalidTenantHint = 'Provide tenantId as a UUID string matching your Supabase context.',
  } = options;

  // If providedTenantId is defined but not a non-empty string, throw 400
  if (providedTenantId !== undefined) {
    if (typeof providedTenantId !== 'string' || !providedTenantId.trim()) {
      throw new TenantResolutionError(
        'tenantId must be a non-empty string',
        400,
        invalidTenantHint,
      );
    }
    return providedTenantId.trim();
  }

  // If session user id exists, return it
  if (session?.user?.id) {
    return session.user.id;
  }

  // Otherwise throw 401
  throw new TenantResolutionError(
    'Unable to determine tenant context',
    401,
    missingTenantHint,
  );
}
