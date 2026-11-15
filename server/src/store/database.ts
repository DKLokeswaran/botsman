import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;
export type Row = Record<string, unknown>;

// Each entry upgrades server.db by one version, in order.
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE owner (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    refresh_hash TEXT NOT NULL,
    device_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
  CREATE TABLE bots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    is_main INTEGER NOT NULL DEFAULT 0,
    avatar TEXT,
    model_provider TEXT,
    model_id TEXT,
    thinking_level TEXT NOT NULL DEFAULT 'medium',
    folder TEXT NOT NULL,
    permission_mode TEXT NOT NULL DEFAULT 'manual',
    approval_wait_ms INTEGER NOT NULL DEFAULT 3600000,
    network INTEGER NOT NULL DEFAULT 1,
    connections TEXT NOT NULL DEFAULT '{}',
    skills TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE UNIQUE INDEX bots_live_name ON bots (lower(name)) WHERE deleted_at IS NULL;
  CREATE TABLE chat_settings (
    bot_id TEXT PRIMARY KEY,
    model_provider TEXT,
    model_id TEXT,
    thinking_level TEXT
  );
  CREATE TABLE credentials (
    provider_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    sealed TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE approvals (
    id TEXT PRIMARY KEY,
    bot_id TEXT NOT NULL,
    conversation TEXT NOT NULL,
    call_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    args TEXT NOT NULL,
    reason TEXT NOT NULL,
    description TEXT NOT NULL,
    command TEXT NOT NULL,
    memory_edit TEXT,
    status TEXT NOT NULL,
    decision TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    answered_at INTEGER
  );
  CREATE INDEX approvals_status ON approvals (status, created_at);
  CREATE TABLE approval_grants (
    bot_id TEXT NOT NULL,
    conversation TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (bot_id, conversation, tool_name)
  );
  CREATE TABLE note_files (
    bot_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mtime_ms INTEGER NOT NULL,
    size INTEGER NOT NULL,
    PRIMARY KEY (bot_id, name)
  );
  CREATE VIRTUAL TABLE note_index USING fts5 (bot_id UNINDEXED, name UNINDEXED, content, tokenize = 'porter unicode61');
  `,
];

// Opens server.db and brings its schema up to date.
export function openDatabase(file: string): Database {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

function migrate(db: Database): void {
  const current = Number((db.prepare("PRAGMA user_version").get() as Row).user_version);
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.exec("BEGIN");
    db.exec(MIGRATIONS[version]!);
    db.exec(`PRAGMA user_version = ${version + 1}`);
    db.exec("COMMIT");
  }
}

// Runs `work` in one transaction.
export function transaction<T>(db: Database, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function readSetting(db: Database, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as Row | undefined;
  return row === undefined ? undefined : String(row.value);
}

export function writeSetting(db: Database, key: string, value: string): void {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(key, value);
}
