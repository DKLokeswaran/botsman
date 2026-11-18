import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { type Alert, type Approval, type Bot, type ChatMessage, SERVER_STREAM, type StreamEvent } from "@botsman/protocol";
import type { Provider } from "@earendil-works/pi-ai";
import { AuthService } from "./auth/auth-service.ts";
import { BotActivityTracker } from "./bots/bot-activity.ts";
import { BotRegistry } from "./bots/bot-registry.ts";
import { BotService } from "./bots/bot-service.ts";
import { type Config, dataPaths } from "./config.ts";
import { Engine } from "./engine/engine.ts";
import { ChatFeed } from "./events/chat-feed.ts";
import { StreamHub } from "./events/stream-hub.ts";
import { MemoryFiles } from "./memory/memory-files.ts";
import { MemoryEdits } from "./memory/memory-edits.ts";
import { NotesStore } from "./notes/notes-store.ts";
import { ApprovalStore } from "./permissions/approval-store.ts";
import { PermissionPolicy } from "./permissions/permission-policy.ts";
import { SealedCredentialStore } from "./providers/credential-store.ts";
import { ProviderCatalog } from "./providers/provider-catalog.ts";
import { ProviderLogins } from "./providers/provider-logins.ts";
import { SandboxManager } from "./sandbox/sandbox-manager.ts";
import { UsageLog } from "./usage/usage-log.ts";
import { LatestRelease } from "./release/latest-release.ts";
import { openDatabase, readSetting, writeSetting, type Database } from "./store/database.ts";
import { AlertSettingsStore } from "./store/alert-settings.ts";
import { SecretBox } from "./store/secret-box.ts";

export const ALERTS_STREAM = "alerts";

export type ServiceOptions = {
  // Extra model providers, such as the scripted test model.
  readonly extraProviders?: readonly { provider: Provider; methods: readonly ("api_key" | "oauth")[] }[];
  readonly cacheLifetimeMs?: number;
  readonly log?: (message: string) => void;
};

// Every server service, wired together. The HTTP layer and the tests both start from here.
export type Services = Awaited<ReturnType<typeof createServices>>;

export async function createServices(config: Config, options: ServiceOptions = {}) {
  const paths = dataPaths(config.dataDir);
  for (const dir of [config.dataDir, paths.userDir, paths.skillsDir, paths.botsDir, paths.workspacesDir]) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const log = options.log ?? ((message: string) => console.log(message));
  const db = openDatabase(paths.serverDb);
  const box = SecretBox.fromFile(paths.secretKey);
  const hub = new StreamHub<StreamEvent>();
  const alerts = new StreamHub<Alert>();
  const publish = (event: StreamEvent) => hub.publish(SERVER_STREAM, event);
  const alertSettings = new AlertSettingsStore(db);
  // Kinds the owner turned off never reach the alerts stream.
  const alert = (kind: Alert["kind"], botId: string, refId: string) => {
    if (alertSettings.wants(kind)) alerts.publish(ALERTS_STREAM, { id: randomUUID(), kind, botId, refId, createdAt: Date.now() });
  };

  const registry = new BotRegistry(db);
  const memoryFiles = new MemoryFiles(paths.userDir, paths.botDir);
  const notes = new NotesStore(db, paths.botDir);
  const approvalStore = new ApprovalStore(db);
  const sandbox = new SandboxManager({ skillsDir: paths.skillsDir, agentsDir: path.join(config.homeDir, ".agents") });
  const credentials = new SealedCredentialStore(db, box, () => publish({ type: "providers_changed" }));
  const catalog = new ProviderCatalog(credentials, options.extraProviders);
  const auth = new AuthService(db, box.deriveKey("access-tokens"));

  const latestRelease = new LatestRelease();
  if (config.releaseCheck) latestRelease.start();

  const usage = new UsageLog(db);
  // Each new reply's usage is logged once, when it first appears; replies already there at startup are not counted again.
  const logUsage = (botId: string, message: ChatMessage) => {
    if (message.type === "assistant" && message.usage !== null) usage.record(botId, message.at ?? Date.now(), message.usage);
  };
  const feed = new ChatFeed(hub, (botId) => approvalStore.pendingByCall(botId), (botId) => alert("failure", botId, botId), logUsage);
  const activity = new BotActivityTracker(db, (botId) => feed.messages(botId), (botId) => feed.working(botId), (line) => publish({ type: "activity", activity: line }));

  const memoryEdits = new MemoryEdits(memoryFiles);
  const policy = new PermissionPolicy(approvalStore, (bot, toolName, args) => memoryEdits.describe(bot, toolName, args), (approval: Approval) => {
    publish({ type: "approval", approval });
    if (approval.status === "pending") alert("approval", approval.botId, approval.id);
    feed.refreshLive(approval.botId);
  });
  const logins = new ProviderLogins(catalog, () => deviceId(db), (login) => publish({ type: "login", login }));

  const engine = new Engine({
    models: catalog.models,
    sessionFile: (botId) => path.join(paths.botDir(botId), "session.sqlite"),
    currentBot: (botId) => registry.get(botId),
    chatSettings: (bot) => registry.chatSettings(bot),
    envFor: (bot) => sandbox.envFor({ botId: bot.id, folder: bot.folder, network: bot.network }),
    stopSandbox: (botId) => sandbox.stop(botId),
    beforeTool: (check) => policy.beforeTool(check),
    memoryTool: {
      listNotes: (botId) => notes.list(botId),
      readNote: (botId, name) => notes.read(botId, name).content,
      writeNote: (botId, name, content) => void notes.write(botId, name, content),
      deleteNote: (botId, name) => notes.delete(botId, name),
      searchNotes: (botId, query) => notes.search(botId, query),
      readMemory: (botId) => memoryFiles.snapshot(botId),
      editMemory: (bot, file, content) => memoryEdits.apply(bot, file, content),
    },
    memorySnapshot: (botId) => memoryFiles.snapshot(botId),
    onView: (botId, view) => {
      feed.update(botId, view);
      activity.refresh(botId);
    },
    log,
    cacheLifetimeMs: options.cacheLifetimeMs,
  });

  const bots = new BotService({
    registry,
    paths,
    homeDir: config.homeDir,
    dataDir: config.dataDir,
    backupDir: config.backupDir,
    memory: memoryFiles,
    lifecycle: {
      changed: async (bot: Bot, previous: Bot | undefined) => {
        publish({ type: "bot", bot });
        // A chat with no model of its own follows the bot's default, so open chats hear about the change.
        if (previous !== undefined) feed.settingsChanged(bot.id, registry.chatSettings(bot));
        if (previous !== undefined && previous.network !== bot.network) sandbox.stop(bot.id);
        if (sandbox.status.ok) await engine.configure(bot);
      },
      deleted: async (botId: string) => {
        policy.cancelAll(botId);
        await engine.close(botId);
        feed.forget(botId);
        activity.forget(botId);
        publish({ type: "bot_deleted", botId });
      },
    },
  });

  // Opens every bot's Harness, so work a crash interrupted resumes without waiting for a message.
  async function resumeBots(): Promise<void> {
    if (!sandbox.status.ok) {
      log(`Bots are not running: ${sandbox.status.reason}`);
      return;
    }
    for (const bot of registry.list()) await engine.open(bot).catch((error) => log(`bot ${bot.id} failed to open: ${String(error)}`));
  }

  async function close(): Promise<void> {
    latestRelease.stop();
    policy.shutDown();
    await engine.closeAll();
    feed.close();
    sandbox.stopAll();
    db.close();
  }

  return { config, paths, db, hub, alerts, auth, registry, bots, memoryFiles, notes, approvalStore, policy, sandbox, catalog, logins, engine, feed, activity, alertSettings, usage, latestRelease, publish, resumeBots, close };
}

// A stable id for this server, which some sign-ins send as the device id.
function deviceId(db: Database): string {
  const existing = readSetting(db, "device_id");
  if (existing !== undefined) return existing;
  const id = randomUUID();
  writeSetting(db, "device_id", id);
  return id;
}
