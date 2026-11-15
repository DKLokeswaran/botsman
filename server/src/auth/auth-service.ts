import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { DeviceSession, Tokens } from "@botsman/protocol";
import { ApiError } from "../errors.ts";
import type { Database, Row } from "../store/database.ts";
import { hashPassword, verifyPassword } from "./passwords.ts";

const ACCESS_TTL_MS = 15 * 60_000;
const REFRESH_TTL_MS = 60 * 24 * 3_600_000;

const sha256 = (text: string) => createHash("sha256").update(text).digest("base64url");

// The owner's password, signed-in devices, and the tokens that keep them signed in.
export class AuthService {
  readonly #db: Database;
  readonly #signingKey: Buffer;
  readonly #now: () => number;

  constructor(db: Database, signingKey: Buffer, now: () => number = Date.now) {
    this.#db = db;
    this.#signingKey = signingKey;
    this.#now = now;
  }

  hasOwner(): boolean {
    return this.#db.prepare("SELECT 1 FROM owner WHERE id = 1").get() !== undefined;
  }

  async createOwner(password: string): Promise<void> {
    if (this.hasOwner()) throw new ApiError(409, "already_set_up", "The server is already set up");
    const hash = await hashPassword(password);
    this.#db.prepare("INSERT INTO owner (id, password_hash, created_at) VALUES (1, ?, ?)").run(hash, this.#now());
  }

  async login(password: string, deviceName: string): Promise<Tokens> {
    const row = this.#db.prepare("SELECT password_hash FROM owner WHERE id = 1").get() as Row | undefined;
    if (row === undefined) throw new ApiError(409, "setup_required", "The server needs first-run setup");
    if (!(await verifyPassword(password, String(row.password_hash)))) {
      throw new ApiError(401, "unauthorized", "Wrong password");
    }
    return this.startSession(deviceName);
  }

  startSession(deviceName: string): Tokens {
    const id = randomBytes(12).toString("base64url");
    const secret = randomBytes(32).toString("base64url");
    const now = this.#now();
    this.#db
      .prepare(
        "INSERT INTO sessions (id, refresh_hash, device_name, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(id, sha256(secret), deviceName, now, now, now + REFRESH_TTL_MS);
    return this.#tokens(id, secret, now);
  }

  // Swaps a refresh token for a new pair. The old refresh token stops working.
  refresh(refreshToken: string): Tokens {
    const [id, secret] = refreshToken.split(".");
    const session = id === undefined ? undefined : this.#liveSession(id);
    if (session === undefined || secret === undefined || !sameText(sha256(secret), String(session.refresh_hash))) {
      throw new ApiError(401, "unauthorized", "Refresh token is not valid");
    }
    const next = randomBytes(32).toString("base64url");
    const now = this.#now();
    this.#db
      .prepare("UPDATE sessions SET refresh_hash = ?, last_used_at = ?, expires_at = ? WHERE id = ?")
      .run(sha256(next), now, now + REFRESH_TTL_MS, id!);
    return this.#tokens(id!, next, now);
  }

  revoke(sessionId: string): void {
    this.#db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(this.#now(), sessionId);
  }

  // Checks an access token and returns its session id.
  verifyAccess(token: string): string {
    const [id, expires, signature] = token.split(".");
    const valid =
      id !== undefined &&
      expires !== undefined &&
      signature !== undefined &&
      sameText(signature, this.#sign(`${id}.${expires}`)) &&
      Number(expires) > this.#now() &&
      this.#liveSession(id) !== undefined;
    if (!valid) throw new ApiError(401, "unauthorized", "Access token is not valid");
    return id;
  }

  // Whether a device session is still signed in, for connections that outlive their access token.
  sessionLive(id: string): boolean {
    return this.#liveSession(id) !== undefined;
  }

  listSessions(currentId?: string): DeviceSession[] {
    const rows = this.#db.prepare("SELECT * FROM sessions ORDER BY last_used_at DESC").all() as Row[];
    return rows.map((row) => ({
      id: String(row.id),
      deviceName: String(row.device_name),
      createdAt: Number(row.created_at),
      lastUsedAt: Number(row.last_used_at),
      expiresAt: Number(row.expires_at),
      revokedAt: row.revoked_at === null ? null : Number(row.revoked_at),
      current: row.id === currentId,
    }));
  }

  #liveSession(id: string): Row | undefined {
    const row = this.#db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Row | undefined;
    if (row === undefined || row.revoked_at !== null || Number(row.expires_at) <= this.#now()) return undefined;
    return row;
  }

  #tokens(id: string, secret: string, now: number): Tokens {
    const accessExpiresAt = now + ACCESS_TTL_MS;
    return {
      accessToken: `${id}.${accessExpiresAt}.${this.#sign(`${id}.${accessExpiresAt}`)}`,
      accessExpiresAt,
      refreshToken: `${id}.${secret}`,
      refreshExpiresAt: now + REFRESH_TTL_MS,
      sessionId: id,
    };
  }

  #sign(text: string): string {
    return createHmac("sha256", this.#signingKey).update(text).digest("base64url");
  }
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
