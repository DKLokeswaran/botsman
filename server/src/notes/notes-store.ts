import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Note, NoteInfo, NoteSearchHit } from "@botsman/protocol";
import { badRequest, notFound } from "../errors.ts";
import { type Database, type Row, transaction } from "../store/database.ts";

const NOTE_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]*\.md$/;

// A bot's notes: Markdown files in bots/<id>/notes/, with an FTS5 keyword index in server.db.
// The index can be rebuilt from the files at any time; it catches up on changed files before each search.
export class NotesStore {
  readonly #db: Database;
  readonly #notesDir: (botId: string) => string;

  constructor(db: Database, botDir: (botId: string) => string) {
    this.#db = db;
    this.#notesDir = (botId) => path.join(botDir(botId), "notes");
  }

  list(botId: string): NoteInfo[] {
    const dir = this.#notesDir(botId);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => NOTE_NAME.test(name))
      .map((name) => {
        const stat = statSync(path.join(dir, name));
        return { name, size: stat.size, modifiedAt: Math.floor(stat.mtimeMs) };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }

  read(botId: string, name: string): Note {
    const file = this.#file(botId, name);
    if (!existsSync(file)) throw notFound(`Note ${name}`);
    return { name, content: readFileSync(file, "utf8"), modifiedAt: Math.floor(statSync(file).mtimeMs) };
  }

  write(botId: string, name: string, content: string): Note {
    const file = this.#file(botId, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(`${file}.tmp`, content, { mode: 0o600 });
    renameSync(`${file}.tmp`, file);
    return this.read(botId, name);
  }

  delete(botId: string, name: string): void {
    const file = this.#file(botId, name);
    if (!existsSync(file)) throw notFound(`Note ${name}`);
    rmSync(file);
  }

  search(botId: string, query: string, limit = 10): NoteSearchHit[] {
    this.#reindex(botId);
    const match = toMatchQuery(query);
    if (match === "") return [];
    const rows = this.#db
      .prepare(
        `SELECT name, snippet(note_index, 2, '[', ']', '…', 12) AS snippet FROM note_index
         WHERE note_index MATCH ? AND bot_id = ? ORDER BY rank LIMIT ?`,
      )
      .all(match, botId, limit) as Row[];
    return rows.map((row) => ({ name: String(row.name), snippet: String(row.snippet) }));
  }

  // Brings the index up to date with the files: new and changed files are indexed, removed ones dropped.
  #reindex(botId: string): void {
    const onDisk = new Map(this.list(botId).map((note) => [note.name, note]));
    const indexed = this.#db.prepare("SELECT name, mtime_ms, size FROM note_files WHERE bot_id = ?").all(botId) as Row[];
    transaction(this.#db, () => {
      for (const row of indexed) {
        const note = onDisk.get(String(row.name));
        if (note === undefined) this.#unindex(botId, String(row.name));
        else if (note.modifiedAt === Number(row.mtime_ms) && note.size === Number(row.size)) onDisk.delete(note.name);
      }
      for (const note of onDisk.values()) this.#index(botId, note);
    });
  }

  #index(botId: string, note: NoteInfo): void {
    this.#unindex(botId, note.name);
    const content = readFileSync(this.#file(botId, note.name), "utf8");
    this.#db.prepare("INSERT INTO note_index (bot_id, name, content) VALUES (?, ?, ?)").run(botId, note.name, content);
    this.#db.prepare("INSERT INTO note_files (bot_id, name, mtime_ms, size) VALUES (?, ?, ?, ?)").run(botId, note.name, note.modifiedAt, note.size);
  }

  #unindex(botId: string, name: string): void {
    this.#db.prepare("DELETE FROM note_index WHERE bot_id = ? AND name = ?").run(botId, name);
    this.#db.prepare("DELETE FROM note_files WHERE bot_id = ? AND name = ?").run(botId, name);
  }

  #file(botId: string, name: string): string {
    if (!NOTE_NAME.test(name)) throw badRequest("A note name is a file name ending in .md, with no folders");
    return path.join(this.#notesDir(botId), name);
  }
}

// Turns free text into an FTS5 query of quoted terms, so punctuation in the text can't break the query syntax.
function toMatchQuery(text: string): string {
  const terms = text.match(/[\p{L}\p{N}_]+/gu) ?? [];
  return terms.map((term) => `"${term}"`).join(" ");
}
