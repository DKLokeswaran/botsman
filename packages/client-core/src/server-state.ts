import type { AlertSettings, Approval, Bot, BotActivity, ProviderLogin, ServerEvent, ServerSnapshot } from "@botsman/protocol";

// What the `server` stream keeps current: the bots, and what is waiting for the owner.
export type ServerState = {
  // `cached` shows what this device saved last time, until the live snapshot arrives.
  status: "loading" | "cached" | "ready";
  bots: Bot[];
  approvals: Approval[];
  // Each bot's activity line, by bot id.
  activity: Record<string, BotActivity>;
  // Provider sign-ins this app started or heard about, by id, kept current from the stream.
  logins: Record<string, ProviderLogin>;
  // Undefined until the server sends them, and on servers older than alert settings.
  alertSettings: AlertSettings | undefined;
  // Goes up whenever a provider is connected or removed, so screens showing providers or models load them again.
  providersVersion: number;
};

export const emptyServerState: ServerState = { status: "loading", bots: [], approvals: [], activity: {}, logins: {}, alertSettings: undefined, providersVersion: 0 };

export function applyServerSnapshot(state: ServerState, snapshot: ServerSnapshot): ServerState {
  const activity = Object.fromEntries((snapshot.activity ?? []).map((line) => [line.botId, line]));
  return { ...state, status: "ready", bots: sortBots(snapshot.bots), approvals: snapshot.approvals, activity, alertSettings: snapshot.alertSettings };
}

export function applyServerEvent(state: ServerState, event: ServerEvent): ServerState {
  if (event.type === "bot") return { ...state, bots: sortBots([...state.bots.filter((bot) => bot.id !== event.bot.id), event.bot]) };
  if (event.type === "bot_deleted") return withoutBot(state, event.botId);
  if (event.type === "approval") return { ...state, approvals: withApproval(state.approvals, event.approval) };
  if (event.type === "activity") return { ...state, activity: { ...state.activity, [event.activity.botId]: event.activity } };
  if (event.type === "login") return withLogin(state, event.login);
  if (event.type === "alert_settings") return { ...state, alertSettings: event.settings };
  if (event.type === "providers_changed") return { ...state, providersVersion: state.providersVersion + 1 };
  return state;
}

// The main bot stays first, then the rest by name.
export function sortBots(bots: Bot[]): Bot[] {
  return [...bots].sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name));
}

function withoutBot(state: ServerState, botId: string): ServerState {
  const { [botId]: _removed, ...activity } = state.activity;
  return { ...state, bots: state.bots.filter((bot) => bot.id !== botId), approvals: state.approvals.filter((approval) => approval.botId !== botId), activity };
}

// Only approvals still waiting are kept. An answered or expired one leaves the list.
function withApproval(approvals: Approval[], approval: Approval): Approval[] {
  const others = approvals.filter((other) => other.id !== approval.id);
  return approval.status === "pending" ? [...others, approval].sort((a, b) => a.createdAt - b.createdAt) : others;
}

export function withLogin(state: ServerState, login: ProviderLogin): ServerState {
  return { ...state, logins: { ...state.logins, [login.id]: login } };
}
