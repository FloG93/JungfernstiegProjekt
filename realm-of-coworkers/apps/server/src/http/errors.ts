// Fehler der HTTP-Schnittstelle (15.2): { ok: false, error: { code, message } }.
import type { ErrorCode } from '@aethra/shared';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  HERO_IN_RUN: 409,
  NOT_ENOUGH_GOLD: 409,
  NOT_ENOUGH_SPLINTERS: 409,
  INVENTORY_FULL: 409,
  REQUIREMENT_NOT_MET: 409,
  NAME_TAKEN: 409,
  RATE_LIMITED: 429,
  SERVER_BUSY: 503,
};

export class ApiError extends Error {
  constructor(public readonly code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export function fail(code: ErrorCode, message?: string): never {
  throw new ApiError(code, message);
}
