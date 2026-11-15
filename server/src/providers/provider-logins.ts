import { randomUUID } from "node:crypto";
import type { LoginStep, ProviderLogin } from "@botsman/protocol";
import type { AuthEvent, AuthPrompt } from "@earendil-works/pi-ai";
import { badRequest, conflict, notFound } from "../errors.ts";
import type { ProviderCatalog } from "./provider-catalog.ts";

const LOGIN_TIMEOUT_MS = 10 * 60_000;

type Running = {
  view: ProviderLogin;
  answer?: { promptId: string; resolve: (value: string) => void };
  controller: AbortController;
};

// Sign-ins pi-ai runs on the server. Each step reaches the app, and the app sends back codes and pasted addresses.
// The server usually runs on another machine, so every browser sign-in also takes a pasted code or address.
export class ProviderLogins {
  readonly #catalog: ProviderCatalog;
  readonly #onChange: (login: ProviderLogin) => void;
  readonly #getDeviceId: () => string;
  readonly #logins = new Map<string, Running>();

  constructor(catalog: ProviderCatalog, getDeviceId: () => string, onChange: (login: ProviderLogin) => void) {
    this.#catalog = catalog;
    this.#getDeviceId = getDeviceId;
    this.#onChange = onChange;
  }

  start(providerId: string): ProviderLogin {
    const entry = this.#catalog.entry(providerId);
    if (!entry.methods.includes("oauth")) throw badRequest(`${entry.provider.name} has no sign-in; use an API key`);
    const running: Running = {
      view: { id: randomUUID(), providerId, status: "running", steps: [], pendingPrompt: null, error: null },
      controller: new AbortController(),
    };
    this.#logins.set(running.view.id, running);
    void this.#run(running);
    return running.view;
  }

  get(loginId: string): ProviderLogin {
    return this.#running(loginId).view;
  }

  answer(loginId: string, promptId: string, value: string): ProviderLogin {
    const running = this.#running(loginId);
    if (running.answer?.promptId !== promptId) throw conflict("That prompt is not waiting for an answer");
    const { resolve } = running.answer;
    running.answer = undefined;
    running.view = { ...running.view, pendingPrompt: null };
    resolve(value);
    this.#onChange(running.view);
    return running.view;
  }

  cancel(loginId: string): ProviderLogin {
    const running = this.#running(loginId);
    running.controller.abort(new Error("Sign-in cancelled"));
    return running.view;
  }

  async #run(running: Running): Promise<void> {
    const timeout = setTimeout(() => running.controller.abort(new Error("Sign-in timed out")), LOGIN_TIMEOUT_MS);
    const interaction = {
      signal: running.controller.signal,
      prompt: (prompt: AuthPrompt) => this.#prompt(running, prompt),
      notify: (event: AuthEvent) => this.#step(running, stepOf(event)),
    };
    try {
      await this.#catalog.models.login(running.view.providerId, "oauth", interaction, { getDeviceId: this.#getDeviceId, agentName: "Botsman" });
      this.#finish(running, "succeeded", null);
    } catch (error) {
      const status = running.controller.signal.aborted && running.controller.signal.reason?.message === "Sign-in cancelled" ? "cancelled" : "failed";
      this.#finish(running, status, error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timeout);
    }
  }

  #prompt(running: Running, prompt: AuthPrompt): Promise<string> {
    const promptId = randomUUID();
    this.#step(running, {
      type: "prompt",
      promptId,
      kind: prompt.type,
      message: prompt.message,
      placeholder: "placeholder" in prompt ? (prompt.placeholder ?? null) : null,
      options: prompt.type === "select" ? prompt.options.map((option) => ({ id: option.id, label: option.label })) : [],
    });
    running.view = { ...running.view, pendingPrompt: promptId };
    this.#onChange(running.view);
    return new Promise((resolve, reject) => {
      running.answer = { promptId, resolve };
      const cancel = () => reject(new Error("Prompt cancelled"));
      prompt.signal?.addEventListener("abort", cancel, { once: true });
      running.controller.signal.addEventListener("abort", cancel, { once: true });
    });
  }

  #step(running: Running, step: LoginStep): void {
    running.view = { ...running.view, steps: [...running.view.steps, step] };
    this.#onChange(running.view);
  }

  #finish(running: Running, status: ProviderLogin["status"], error: string | null): void {
    running.answer = undefined;
    running.view = { ...running.view, status, error, pendingPrompt: null };
    this.#onChange(running.view);
  }

  #running(loginId: string): Running {
    const running = this.#logins.get(loginId);
    if (running === undefined) throw notFound("Sign-in");
    return running;
  }
}

function stepOf(event: AuthEvent): LoginStep {
  switch (event.type) {
    case "auth_url":
      return { type: "auth_url", url: event.url, instructions: event.instructions ?? null };
    case "device_code":
      return { type: "device_code", userCode: event.userCode, verificationUri: event.verificationUri };
    case "info":
      return { type: "info", message: event.message };
    case "progress":
      return { type: "progress", message: event.message };
  }
}
