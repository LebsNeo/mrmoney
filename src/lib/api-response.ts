/**
 * MrMoney — Standardised API Response Helpers
 * Phase 9: Consistent JSON response format for all /api/* routes.
 */
import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function apiUnauthorized(message = "Unauthorized") {
  return apiError(message, 401);
}

export function apiNotFound(message = "Not found") {
  return apiError(message, 404);
}

export function apiServerError(message = "Internal server error") {
  return apiError(message, 500);
}
