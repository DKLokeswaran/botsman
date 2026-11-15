import { int, obj, oneOf, opt, type Static, str } from "@earendil-works/pi-schema";

// Every error body the server sends.
export const ErrorBody = obj({
  error: str(),
  message: str(),
  detail: opt(str()),
});
export type ErrorBody = Static<typeof ErrorBody>;

export const Ok = obj({ ok: oneOf([true]) });
export type Ok = Static<typeof Ok>;

export const IdParams = obj({ id: str({ minLength: 1 }) });
export type IdParams = Static<typeof IdParams>;

export const PageQuery = obj({
  before: opt(str()),
  limit: opt(int({ minimum: 1, maximum: 200 })),
});
export type PageQuery = Static<typeof PageQuery>;

export const ErrorCodes = [
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "https_required",
  "rate_limited",
  "setup_required",
  "already_set_up",
  "sandbox_unavailable",
  "model_not_connected",
  "unsafe_folder",
  "memory_limit",
  "internal",
] as const;
export type ErrorCode = (typeof ErrorCodes)[number];
