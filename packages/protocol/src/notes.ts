import { arr, int, obj, opt, type Static, str } from "@earendil-works/pi-schema";

// Note names are plain file names ending in .md, with no folders.
export const NoteName = str({ minLength: 4, maxLength: 120, pattern: "^[A-Za-z0-9][A-Za-z0-9 ._-]*\\.md$" });

export const NoteInfo = obj({ name: str(), size: int(), modifiedAt: int() });
export type NoteInfo = Static<typeof NoteInfo>;

export const NoteList = obj({ notes: arr(NoteInfo) });
export type NoteList = Static<typeof NoteList>;

export const Note = obj({ name: str(), content: str(), modifiedAt: int() });
export type Note = Static<typeof Note>;

export const NoteParams = obj({ id: str({ minLength: 1 }), name: NoteName });
export type NoteParams = Static<typeof NoteParams>;

export const NoteWrite = obj({ content: str({ maxLength: 1_000_000 }) });
export type NoteWrite = Static<typeof NoteWrite>;

export const NoteSearchQuery = obj({ q: str({ minLength: 1, maxLength: 500 }), limit: opt(int({ minimum: 1, maximum: 50 })) });
export type NoteSearchQuery = Static<typeof NoteSearchQuery>;

export const NoteSearchHit = obj({ name: str(), snippet: str() });
export type NoteSearchHit = Static<typeof NoteSearchHit>;

export const NoteSearchResult = obj({ hits: arr(NoteSearchHit) });
export type NoteSearchResult = Static<typeof NoteSearchResult>;
