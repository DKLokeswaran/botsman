import { type AlertKind, type AlertSettings, type AlertSettingsUpdate } from "@botsman/protocol";
import { type Database, readSetting, writeSetting } from "./database.ts";

const KEY = "alert_settings";

const ALL_ON: AlertSettings = {
  approval: true,
  question: true,
  routine_result: true,
  failure: true,
  channel_mention: true,
  routine_created: true,
  skill_created: true,
};

// The owner's alert choices, kept in server.db so every device shares them. Every kind starts on.
export class AlertSettingsStore {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  get(): AlertSettings {
    const stored = readSetting(this.#db, KEY);
    return stored === undefined ? ALL_ON : { ...ALL_ON, ...(JSON.parse(stored) as Partial<AlertSettings>) };
  }

  update(change: AlertSettingsUpdate): AlertSettings {
    const settings = { ...this.get(), ...definedOnly(change) };
    writeSetting(this.#db, KEY, JSON.stringify(settings));
    return settings;
  }

  wants(kind: AlertKind): boolean {
    return this.get()[kind];
  }
}

function definedOnly(change: AlertSettingsUpdate): Partial<AlertSettings> {
  return Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined));
}
