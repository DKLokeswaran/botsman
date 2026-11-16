import type { FastifyRequest } from "fastify";
import { ACCESS_COOKIE, readCookie, sameOrigin } from "./cookies.ts";

// The access token for a socket's `hello`. An app sends its token in the message. The dashboard sends an empty
// one, and its cookie counts only when the socket was opened from the dashboard's own pages.
export function socketToken(request: FastifyRequest, fromMessage: string): string {
  if (fromMessage !== "") return fromMessage;
  if (!sameOrigin(request.headers.origin, request.host)) return "";
  return readCookie(request.headers.cookie, ACCESS_COOKIE) ?? "";
}
