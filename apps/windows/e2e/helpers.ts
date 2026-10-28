import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { APP_ORIGIN, FAKE_ORIGIN, SHIM_MARKER } from "./constants";

export type FakeRequest = {
  id: string;
  method: string;
  params: Record<string, unknown>;
};

export type FakeState = {
  open_requests: FakeRequest[];
  history: Array<{ role?: string; text?: string; row_id?: number | string }>;
  profiles: Array<{ name?: string; display_name?: string }>;
  sessions: Array<{ id?: string; live_id?: string; title?: string }>;
  extras: Array<{ id: string; title: string; marker: string }>;
};

export type UiState = {
  status: string;
  versions: string[];
  buttons: string[];
  lines: Array<{ role: string; text: string; landed: boolean }>;
  approval: string | null;
  needsYou: number;
};

export type ApprovalCard = {
  requestId: string;
  sessionId: string;
  description: string;
};

async function postHook(path: string, body: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${FAKE_ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status})`);
  }
}

export async function resetFake(): Promise<void> {
  await postHook("/__test__/reset", {});
}

export async function readFake(): Promise<FakeState> {
  const response = await fetch(`${FAKE_ORIGIN}/__test__/state`);
  if (!response.ok) {
    throw new Error(`fake state failed (${response.status}). Start the fake with HERMES_FAKE_TEST_HOOKS=1.`);
  }
  return (await response.json()) as FakeState;
}

/** Next prompt.submit reply. Ignored unless the fake was started with the test-hook flag. */
export async function scriptReply(text: string): Promise<void> {
  await postHook("/__test__/reply", { text });
}

/** Extra session the stock list does not have. Resume and history return its marker. */
export async function scriptSession(id: string, title: string, marker: string): Promise<void> {
  await postHook("/__test__/session", { id, title, marker });
}

export async function openApp(page: Page): Promise<void> {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "HERMES BOTS" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => window.__hermesE2e?.marker)).toBe(SHIM_MARKER);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
}

export async function login(page: Page): Promise<void> {
  if (!page.url().startsWith(APP_ORIGIN)) {
    await openApp(page);
  }
  const fake = await readFake();
  const profile = fake.profiles[0];
  const profileName = String(profile?.display_name || profile?.name || "");
  await page.getByLabel("Hermes server").fill(APP_ORIGIN);
  await page.getByLabel("Username").fill("tester");
  await page.getByLabel("Password").fill("tester");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator("header p").first()).toHaveText(/^Connected/);
  if (profileName) {
    await expect(page.getByText(profileName).first()).toBeVisible();
  }
}

export async function openSession(page: Page, title?: string): Promise<void> {
  const fake = await readFake();
  const session = (title ? fake.sessions.find((item) => item.title === title) : fake.sessions[0]) ?? null;
  if (!session?.title) {
    throw new Error(`no session titled ${title ?? "(first)"}`);
  }
  const extra = fake.extras.find((item) => item.id === session.id);
  await page.getByRole("button", { name: session.title, exact: true }).click();
  const ready = extra?.marker ?? String(fake.history[0]?.text ?? "");
  if (ready) {
    await expect(page.getByText(ready, { exact: true })).toBeVisible();
  }
}

/**
 * The fake emits one approval when the client connects. The card is visible only
 * in the session it belongs to, and that session receives live events only after
 * resume. Open it the way the app does, then wait for the card.
 */
export async function triggerApproval(page: Page): Promise<ApprovalCard> {
  const fake = await readFake();
  const pending = fake.open_requests.find((item) => item.method === "approval");
  if (!pending) {
    throw new Error("fake has no open approval");
  }
  const ownerId = String(pending.params.session_id ?? "");
  const owner =
    fake.sessions.find((item) => item.id === ownerId || item.live_id === ownerId) ?? fake.sessions[0] ?? null;
  if (owner?.title) {
    await page.getByRole("button", { name: owner.title, exact: true }).click();
    const extra = fake.extras.find((item) => item.id === owner.id);
    const ready = extra?.marker ?? String(fake.history[0]?.text ?? "");
    if (ready) {
      await expect(page.getByText(ready, { exact: true })).toBeVisible();
    }
  }
  const card = page.locator("main section").filter({ has: page.getByText("Needs you", { exact: true }) });
  await expect(card).toHaveCount(1);
  const description = String(pending.params.description ?? "");
  if (description) {
    await expect(card).toContainText(description);
  }
  return {
    requestId: String(pending.params.request_id || pending.id),
    sessionId: String(pending.params.session_id ?? ""),
    description,
  };
}

export async function sendMessage(page: Page, text: string): Promise<void> {
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const firstLine = text.split("\n")[0] ?? text;
  await expect(page.locator("p.user-text").filter({ hasText: firstLine }).first()).toBeVisible();
}

export async function readState(page: Page): Promise<UiState> {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    const headerText = header ? [...header.querySelectorAll("p")].map((node) => node.textContent?.trim() ?? "") : [];
    const versionPattern = /\d+\.\d+\.\d+ \(build [^,]+, [^)]+\)/;
    const versions = [...document.querySelectorAll("p")]
      .map((node) => node.textContent?.trim() ?? "")
      .filter((text) => versionPattern.test(text));
    const lines = [...document.querySelectorAll("main article")].map((article) => {
      const role = article.querySelector("p")?.textContent?.trim() ?? "";
      const body = article.querySelector(".reply, .user-text, p:last-of-type");
      return {
        role,
        text: body?.textContent?.trim() ?? "",
        landed: article.classList.contains("landed"),
      };
    });
    const sections = [...document.querySelectorAll("main section")].filter((section) => !section.textContent?.includes("Question"));
    const openCards = sections.filter((section) => section.textContent?.includes("Needs you"));
    const approvalCard = openCards[0] ?? sections[0];
    return {
      status: headerText[0] ?? "",
      versions,
      buttons: [...document.querySelectorAll("button")].map((button) => (button.textContent ?? "").trim()),
      lines,
      approval: approvalCard?.textContent?.trim() ?? null,
      needsYou: openCards.length,
    };
  });
}

export async function tapNotification(page: Page, route: Record<string, unknown>): Promise<void> {
  await page.evaluate((payload) => {
    const bridge = window.__hermesE2e;
    if (!bridge) {
      throw new Error("Hermes e2e shim is not installed");
    }
    bridge.tapNotification(payload);
  }, JSON.stringify(route));
}

export async function newDevice(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    baseURL: APP_ORIGIN,
    colorScheme: "light",
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  await context.addInitScript(() => {
    document.documentElement.dataset.theme = "light";
  });
  const page = await context.newPage();
  return { context, page };
}

declare global {
  interface Window {
    __hermesE2e?: {
      marker: string;
      tapNotification: (route: string) => void;
      setHidden: (hidden: boolean) => void;
      foregrounds: () => number;
      lastNotificationRoute: () => string;
      clickNotification: () => void;
    };
  }
}
