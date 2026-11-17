import { IdParams, type Note, type NoteList, NoteParams, NoteSearchQuery, type NoteSearchResult, NoteWrite, type Ok } from "@botsman/protocol";
import type { FastifyInstance } from "fastify";
import type { Services } from "../services.ts";

export function registerNoteRoutes(app: FastifyInstance, services: Services): void {
  const { bots, notes } = services;

  app.get<{ Params: IdParams }>("/api/bots/:id/notes", { schema: { params: IdParams } }, async (request): Promise<NoteList> => ({ notes: notes.list(bots.get(request.params.id).id) }));

  app.get<{ Params: IdParams; Querystring: NoteSearchQuery }>("/api/bots/:id/notes-search", { schema: { params: IdParams, querystring: NoteSearchQuery } }, async (request): Promise<NoteSearchResult> => ({
    hits: notes.search(bots.get(request.params.id).id, request.query.q, request.query.limit),
  }));

  app.get<{ Params: NoteParams }>("/api/bots/:id/notes/:name", { schema: { params: NoteParams } }, async (request): Promise<Note> => notes.read(bots.get(request.params.id).id, request.params.name));

  app.put<{ Params: NoteParams; Body: NoteWrite }>("/api/bots/:id/notes/:name", { schema: { params: NoteParams, body: NoteWrite } }, async (request): Promise<Note> =>
    notes.write(bots.get(request.params.id).id, request.params.name, request.body.content, request.body.onlyNew ?? false),
  );

  app.delete<{ Params: NoteParams }>("/api/bots/:id/notes/:name", { schema: { params: NoteParams } }, async (request): Promise<Ok> => {
    notes.delete(bots.get(request.params.id).id, request.params.name);
    return { ok: true };
  });
}
