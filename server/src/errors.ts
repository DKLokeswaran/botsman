import type { ErrorCode } from "@botsman/protocol";

// An error the API reports to the client with a status and a stable code.
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly detail?: string;

  constructor(status: number, code: ErrorCode, message: string, detail?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found`);
export const badRequest = (message: string) => new ApiError(400, "bad_request", message);
export const conflict = (message: string) => new ApiError(409, "conflict", message);
