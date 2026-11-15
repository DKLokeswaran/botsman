import type { Credential, CredentialInfo, CredentialStore } from "@earendil-works/pi-ai";
import type { Database, Row } from "../store/database.ts";
import type { SecretBox } from "../store/secret-box.ts";

// pi-ai's credential store, backed by server.db with every credential encrypted.
// Writes for one provider run one at a time, so token refreshes never race.
export class SealedCredentialStore implements CredentialStore {
  readonly #db: Database;
  readonly #box: SecretBox;
  readonly #onChange: () => void;
  readonly #locks = new Map<string, Promise<unknown>>();

  constructor(db: Database, box: SecretBox, onChange: () => void = () => {}) {
    this.#db = db;
    this.#box = box;
    this.#onChange = onChange;
  }

  async read(providerId: string): Promise<Credential | undefined> {
    const row = this.#db.prepare("SELECT sealed FROM credentials WHERE provider_id = ?").get(providerId) as Row | undefined;
    return row === undefined ? undefined : this.#open(String(row.sealed));
  }

  // Credentials sealed with a different key, such as after a restore without secret.key, count as not connected.
  async list(): Promise<readonly CredentialInfo[]> {
    const rows = this.#db.prepare("SELECT provider_id, type, sealed FROM credentials").all() as Row[];
    return rows
      .filter((row) => this.#open(String(row.sealed)) !== undefined)
      .map((row) => ({ providerId: String(row.provider_id), type: row.type as Credential["type"] }));
  }

  #open(sealed: string): Credential | undefined {
    try {
      return JSON.parse(this.#box.open(sealed)) as Credential;
    } catch {
      return undefined;
    }
  }

  modify(providerId: string, change: (current: Credential | undefined) => Promise<Credential | undefined>): Promise<Credential | undefined> {
    return this.#serialize(providerId, async () => {
      const current = await this.read(providerId);
      const next = await change(current);
      if (next === undefined) return current;
      this.#db
        .prepare(
          `INSERT INTO credentials (provider_id, type, sealed, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (provider_id) DO UPDATE SET type = excluded.type, sealed = excluded.sealed, updated_at = excluded.updated_at`,
        )
        .run(providerId, next.type, this.#box.seal(JSON.stringify(next)), Date.now());
      this.#onChange();
      return next;
    });
  }

  delete(providerId: string): Promise<void> {
    return this.#serialize(providerId, async () => {
      this.#db.prepare("DELETE FROM credentials WHERE provider_id = ?").run(providerId);
      this.#onChange();
    });
  }

  #serialize<T>(providerId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.#locks.get(providerId) ?? Promise.resolve();
    const next = previous.then(work, work);
    this.#locks.set(providerId, next.catch(() => undefined));
    return next;
  }
}
