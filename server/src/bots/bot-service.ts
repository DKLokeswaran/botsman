import { mkdirSync, statfsSync } from "node:fs";
import path from "node:path";
import type { Bot, BotCreate, BotUpdate, FreeSpace } from "@botsman/protocol";
import type { dataPaths } from "../config.ts";
import { ApiError, badRequest, notFound } from "../errors.ts";
import type { MemoryFiles } from "../memory/memory-files.ts";
import { BotRegistry } from "./bot-registry.ts";
import { checkFolder, expandHome, resolveReal } from "./folder-policy.ts";

export type BotLifecycle = {
  // Called after a bot is created or changed, to reopen or reconfigure what depends on it.
  changed(bot: Bot, previous: Bot | undefined): Promise<void>;
  // Called after a bot is marked deleted, to stop everything it runs.
  deleted(botId: string): Promise<void>;
};

// Creating, editing, and deleting bots, with the folder rules and the memory files that go with them.
export class BotService {
  readonly #registry: BotRegistry;
  readonly #paths: ReturnType<typeof dataPaths>;
  readonly #homeDir: string;
  readonly #dataDir: string;
  readonly #backupDir: string;
  readonly #memory: MemoryFiles;
  readonly #lifecycle: BotLifecycle;

  constructor(options: {
    registry: BotRegistry;
    paths: ReturnType<typeof dataPaths>;
    homeDir: string;
    dataDir: string;
    backupDir: string;
    memory: MemoryFiles;
    lifecycle: BotLifecycle;
  }) {
    this.#registry = options.registry;
    this.#paths = options.paths;
    this.#homeDir = options.homeDir;
    this.#dataDir = options.dataDir;
    this.#backupDir = options.backupDir;
    this.#memory = options.memory;
    this.#lifecycle = options.lifecycle;
  }

  list(): Bot[] {
    return this.#registry.list();
  }

  get(id: string): Bot {
    const bot = this.#registry.get(id);
    if (bot === undefined) throw notFound("Bot");
    return bot;
  }

  async create(request: BotCreate, isMain = false): Promise<Bot> {
    if (isMain && this.#registry.mainBot() !== undefined) throw badRequest("The main bot already exists");
    const id = BotRegistry.newId();
    const folder = this.#allowedFolder(id, request.folder);
    mkdirSync(folder, { recursive: true });
    const bot = this.#registry.create(id, {
      name: request.name.trim(),
      description: request.description ?? "",
      defaultModel: request.defaultModel ?? null,
      folder,
      isMain,
    });
    this.#memory.write(id, "BOT_PROFILE.md", request.purpose ?? "");
    await this.#lifecycle.changed(bot, undefined);
    return bot;
  }

  async update(id: string, change: BotUpdate): Promise<Bot> {
    const previous = this.get(id);
    const bot = this.#registry.update(id, change);
    await this.#lifecycle.changed(bot, previous);
    return bot;
  }

  async delete(id: string): Promise<void> {
    const bot = this.get(id);
    if (bot.isMain) throw new ApiError(403, "forbidden", "The main bot can't be deleted");
    this.#registry.markDeleted(id);
    await this.#lifecycle.deleted(id);
  }

  // Free space for a proposed folder, and whether the server would accept it for a new bot.
  freeSpace(requested: string | undefined): FreeSpace {
    const target = requested ? resolveReal(expandHome(requested, this.#homeDir)) : this.#paths.workspacesDir;
    const check = requested ? checkFolder(requested, this.#rules("new")) : ({ allowed: true } as const);
    const stats = statfsSync(existingAncestor(target));
    return {
      path: target,
      freeBytes: Number(stats.bavail) * Number(stats.bsize),
      totalBytes: Number(stats.blocks) * Number(stats.bsize),
      allowed: check.allowed,
      reason: check.allowed ? undefined : check.reason,
    };
  }

  #allowedFolder(id: string, requested: string | undefined): string {
    if (!requested) return this.#paths.defaultWorkspace(id);
    const check = checkFolder(requested, this.#rules(id));
    if (!check.allowed) throw new ApiError(400, "unsafe_folder", check.reason);
    return check.path;
  }

  #rules(id: string) {
    return {
      homeDir: this.#homeDir,
      dataDir: this.#dataDir,
      backupDir: this.#backupDir,
      defaultFolder: this.#paths.defaultWorkspace(id),
      otherBotFolders: this.#registry.folders(id),
    };
  }
}

function existingAncestor(target: string): string {
  let current = target;
  while (current !== path.dirname(current)) {
    try {
      statfsSync(current);
      return current;
    } catch {
      current = path.dirname(current);
    }
  }
  return current;
}
