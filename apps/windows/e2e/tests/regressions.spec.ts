import { expect, test } from "@playwright/test";
import { readButtonContrasts } from "../contrast";
import {
  login,
  newDevice,
  openApp,
  openSession,
  readFake,
  readState,
  resetFake,
  scriptReply,
  scriptSession,
  sendMessage,
  tapNotification,
  triggerApproval,
} from "../helpers";

const CODE = ['def greet():', '    return "hi"'].join("\n");
const MARKDOWN = ["Items:", "", "- alpha", "- beta", "", "```python", CODE, "```", ""].join("\n");

test.describe("windows ui regressions", () => {
  test.beforeEach(async ({ page }) => {
    await resetFake();
    await page.addInitScript(() => {
      document.documentElement.dataset.theme = "light";
    });
  });

  test("test_bug_one_approval_card_at_bottom", async ({ page }) => {
    await login(page);
    await openSession(page);
    const card = await triggerApproval(page);
    const state = await readState(page);
    expect(state.needsYou).toBe(1);
    expect(state.approval).toContain("Needs you");
    if (card.description) {
      expect(state.approval).toContain(card.description);
    }
    await expect(page.getByRole("button", { name: "Allow once" })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Deny" })).toHaveCount(1);
    await expect.poll(async () =>
      page.evaluate(() => {
        const main = document.querySelector("main");
        const composer = document.querySelector("form");
        if (!main || !composer) {
          return "missing conversation";
        }
        const articles = [...main.querySelectorAll("article")];
        const cards = [...main.querySelectorAll("section")].filter((section) => section.textContent?.includes("Needs you"));
        if (cards.length !== 1) {
          return `cards ${cards.length}`;
        }
        if (articles.length === 0) {
          return "no transcript";
        }
        const approval = cards[0];
        const last = articles[articles.length - 1];
        if ((last.compareDocumentPosition(approval) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) {
          return "card is not after the transcript";
        }
        if ((approval.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) {
          return "card is not above the composer";
        }
        main.scrollTop = main.scrollHeight;
        const cardBox = approval.getBoundingClientRect();
        const lastBox = last.getBoundingClientRect();
        const mainBox = main.getBoundingClientRect();
        if (cardBox.top + 1 < lastBox.bottom) {
          return `card overlaps the transcript (${cardBox.top} < ${lastBox.bottom})`;
        }
        if (cardBox.top < mainBox.top - 2 || cardBox.bottom > mainBox.bottom + 2) {
          return `card is not in view at the bottom (${cardBox.top}-${cardBox.bottom} vs ${mainBox.top}-${mainBox.bottom})`;
        }
        return "ok";
      }),
    ).toBe("ok");
  });

  test("test_bug_approval_clears_or_marks_on_other_device", async ({ browser }) => {
    const first = await newDevice(browser);
    const second = await newDevice(browser);
    try {
      await login(first.page);
      await login(second.page);
      await openSession(first.page);
      await openSession(second.page);
      await triggerApproval(first.page);
      await triggerApproval(second.page);
      await first.page.getByRole("button", { name: "Allow once" }).click();
      await expect(first.page.getByText("Needs you", { exact: true })).toHaveCount(0);
      await expect(second.page.getByRole("button", { name: "Allow once" })).toHaveCount(0);
      await expect.poll(async () => {
        const marked = await second.page.getByText("Approved on another device").count();
        const needs = await second.page.getByText("Needs you", { exact: true }).count();
        return marked > 0 || needs === 0;
      }).toBe(true);
      const other = await readState(second.page);
      const cleared = other.needsYou === 0;
      const marked = (other.approval ?? "").includes("Approved on another device");
      expect(cleared || marked).toBe(true);
    } finally {
      await first.context.close();
      await second.context.close();
    }
  });

  test("test_bug_markdown_list_and_fenced_code", async ({ page }) => {
    await login(page);
    await openSession(page);
    await scriptReply(MARKDOWN);
    await sendMessage(page, "show markdown");
    const list = page.locator(".reply ul");
    await expect(list).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("listitem").nth(0)).toHaveText("alpha");
    await expect(list.getByRole("listitem").nth(1)).toHaveText("beta");
    const marker = await list.evaluate((element) => getComputedStyle(element).listStyleType);
    expect(marker).toBe("disc");
    const fence = page.locator(".fence");
    await expect(fence).toBeVisible();
    await expect(fence.locator(".fence-bar span")).toHaveText("python");
    await expect(fence).toContainText("def greet():");
    await expect(fence).toContainText('return "hi"');
    const keyword = fence.locator(".hljs-keyword").first();
    await expect(keyword).toBeVisible();
    const colors = await keyword.evaluate((element) => {
      const code = element.closest("code");
      return {
        keyword: getComputedStyle(element).color,
        code: code ? getComputedStyle(code).color : "",
      };
    });
    expect(colors.keyword).not.toBe(colors.code);
    await fence.getByRole("button", { name: "Copy" }).click();
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe(CODE);
    await expect(fence.getByRole("button", { name: "Copied" })).toBeVisible();
  });

  test("test_bug_long_user_message_collapses", async ({ page }) => {
    await login(page);
    await openSession(page);
    const lines = Array.from({ length: 12 }, (_, index) => `row ${index + 1} of the long user message`);
    await sendMessage(page, lines.join("\n"));
    const paragraph = page.locator("p.user-text").filter({ hasText: "row 1 of the long user message" });
    await expect(paragraph).toBeVisible();
    const metrics = await paragraph.evaluate((element) => {
      const probe = document.createElement("p");
      probe.className = "user-text";
      probe.textContent = "row 1 of the long user message";
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      element.parentElement?.append(probe);
      const lineHeight = probe.getBoundingClientRect().height;
      probe.remove();
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        lineHeight,
        clamped: element.classList.contains("line-clamp-6"),
      };
    });
    expect(metrics.clamped).toBe(true);
    expect(metrics.lineHeight).toBeGreaterThan(0);
    const shown = metrics.clientHeight / metrics.lineHeight;
    expect(shown).toBeGreaterThan(5.4);
    expect(shown).toBeLessThan(6.6);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight + metrics.lineHeight);
    await page.getByRole("button", { name: "Show more" }).click();
    await expect(page.getByRole("button", { name: "Show less" })).toBeVisible();
    const expanded = await paragraph.evaluate((element) => element.clientHeight);
    expect(expanded).toBeGreaterThan(metrics.clientHeight + metrics.lineHeight);
    await expect(paragraph).toContainText("row 12 of the long user message");
    await page.getByRole("button", { name: "Show less" }).click();
    await expect(page.getByRole("button", { name: "Show more" })).toBeVisible();
    const collapsed = await paragraph.evaluate((element) => element.clientHeight);
    expect(collapsed).toBeLessThan(expanded);
  });

  test("test_bug_notification_deep_link_highlights", async ({ page }) => {
    await login(page);
    const approval = await triggerApproval(page);
    const fake = await readFake();
    const line = fake.history[0];
    const messageId = line?.row_id === undefined || line?.row_id === null ? "" : String(line.row_id);
    const messageText = String(line?.text ?? "");
    await tapNotification(page, {
      kind: "approval",
      title: "Approval waiting",
      body: approval.description,
      session_id: approval.sessionId,
      profile: "",
      request_id: approval.requestId,
      message_id: "",
      seq: null,
    });
    if (messageText) {
      await expect(page.getByText(messageText, { exact: true })).toBeVisible();
    }
    const card = page.locator("main section.landed");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Needs you");
    await expect(card).toBeInViewport();
    const opened = await readState(page);
    expect(opened.lines.some((item) => item.text.includes(messageText))).toBe(true);

    await page.reload();
    await expect(page.locator("header p").first()).toHaveText(/^Connected/);
    await tapNotification(page, {
      kind: "reply",
      title: "Reply finished",
      body: messageText,
      session_id: approval.sessionId || String(fake.sessions[0]?.id ?? ""),
      profile: "",
      request_id: "",
      message_id: messageId,
      seq: null,
    });
    const landed = page.locator("main article.landed");
    await expect(landed).toBeVisible();
    await expect(landed).toContainText(messageText);
    await expect(landed).toBeInViewport();
    const highlighted = await readState(page);
    expect(highlighted.lines.some((item) => item.landed && item.text.includes(messageText))).toBe(true);
  });

  test("test_bug_light_mode_button_contrast", async ({ page }) => {
    // Every button mounted on the login screen, then on an open session (approval actions and Show more).
    await openApp(page);
    const signedOut = await readButtonContrasts(page);
    expect(signedOut.length).toBeGreaterThan(0);
    for (const button of signedOut) {
      expect(button.ratio, `${button.name} ${button.ratio.toFixed(2)} ${button.color} on ${button.background}`).toBeGreaterThanOrEqual(4.5);
    }

    await login(page);
    await openSession(page);
    await triggerApproval(page);
    const long = Array.from({ length: 12 }, (_, index) => `contrast row ${index + 1}`).join("\n");
    await sendMessage(page, long);
    await expect(page.getByRole("button", { name: "Show more" })).toBeVisible();

    const signedIn = await readButtonContrasts(page);
    const names = signedIn.map((button) => button.name.toLowerCase());
    expect(names).toContain("allow once");
    expect(names).toContain("deny");
    expect(names).toContain("send");
    expect(names.some((name) => name.includes("show more"))).toBe(true);
    for (const button of signedIn) {
      expect(button.ratio, `${button.name} ${button.ratio.toFixed(2)} ${button.color} on ${button.background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("test_bug_version_label_on_login_and_about", async ({ page }) => {
    await openApp(page);
    const state = await readState(page);
    expect(state.versions.length).toBe(2);
    expect(new Set(state.versions).size).toBe(1);
    const versions = page.getByText(/\d+\.\d+\.\d+ \(build [^,]+, [^)]+\)/);
    await expect(versions).toHaveCount(2);
    await expect(versions.nth(0)).toBeVisible();
    await expect(versions.nth(1)).toBeVisible();
    const about = page.locator("div").filter({ has: page.getByText("About", { exact: true }) }).last();
    await expect(about.getByText("About", { exact: true })).toBeVisible();
    await expect(about.getByText(/\d+\.\d+\.\d+ \(build [^,]+, [^)]+\)/)).toBeVisible();
    await expect(page.locator("header").getByText(/\d+\.\d+\.\d+ \(build [^,]+, [^)]+\)/)).toBeVisible();
  });

  test("test_bug_one_line_code_fence_without_language", async ({ page }) => {
    await login(page);
    await openSession(page);
    await scriptReply("Run it:\n\n```\necho hello\n```\n");
    await sendMessage(page, "show a one-line fence");
    const fence = page.locator(".fence");
    await expect(fence).toBeVisible();
    await expect(fence).toContainText("echo hello");
    await expect(fence.locator(".fence-bar span")).not.toHaveText("");
    await expect(fence.locator("[class*='hljs-']").first()).toBeVisible();
    await fence.getByRole("button", { name: "Copy" }).click();
    await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe("echo hello");
  });

  test("test_bug_deny_scoped_to_session", async ({ browser }) => {
    await scriptSession("sess-other", "Other", "Other session transcript");
    const first = await newDevice(browser);
    const second = await newDevice(browser);
    try {
      await login(first.page);
      await login(second.page);
      await openSession(second.page, "Hello");
      const approval = await triggerApproval(second.page);
      await openSession(second.page, "Other");
      await expect(second.page.getByText("Needs you", { exact: true })).toHaveCount(0);
      if (approval.description) {
        await expect(second.page.getByText(approval.description, { exact: true })).toHaveCount(0);
      }
      await openSession(second.page, "Hello");
      await triggerApproval(second.page);
      await openSession(first.page, "Hello");
      await triggerApproval(first.page);
      await first.page.getByRole("button", { name: "Deny" }).click();
      await expect(second.page.getByText("Denied on another device", { exact: true })).toBeVisible();
      await expect(second.page.getByText("Approved on another device")).toHaveCount(0);
      await expect(second.page.getByRole("button", { name: "Allow once" })).toHaveCount(0);
      const other = await readState(second.page);
      expect(other.approval ?? "").toContain("Denied");
      expect(other.approval ?? "").not.toContain("Approved on another device");
    } finally {
      await first.context.close();
      await second.context.close();
    }
  });

  test("test_bug_autoscroll_after_send", async ({ page }) => {
    await login(page);
    await openSession(page);
    const filler = Array.from(
      { length: 50 },
      (_, index) => `Scroll filler paragraph ${index} so the transcript is taller than the pane.`,
    ).join("\n\n");
    await scriptReply(filler);
    await sendMessage(page, "seed the scrollback");
    await expect(page.getByText("Scroll filler paragraph 49")).toBeVisible();
    await page.locator("main").evaluate((element) => {
      element.scrollTop = 0;
    });
    await expect(page.getByText("Scroll filler paragraph 49")).not.toBeInViewport();
    await sendMessage(page, "bottom ping");
    await expect(page.getByText("bottom ping", { exact: true })).toBeInViewport();
  });

  test("test_bug_message_syncs_to_other_device", async ({ browser }) => {
    const first = await newDevice(browser);
    const second = await newDevice(browser);
    try {
      await login(first.page);
      await login(second.page);
      await openSession(first.page);
      await openSession(second.page);
      await sendMessage(first.page, "ping from device A");
      await expect(second.page.getByText("ping from device A", { exact: true })).toBeVisible();
      const other = await readState(second.page);
      expect(other.lines.some((line) => line.text.includes("ping from device A"))).toBe(true);
    } finally {
      await first.context.close();
      await second.context.close();
    }
  });
});
