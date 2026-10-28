import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { chatLineKey } from "./chat-line-key";
import { UserLine } from "./markdown";

const LONG = Array.from({ length: 12 }, (_, index) => `row ${index + 1} of the long user message`).join("\n");

function Transcript({ messageId }: { messageId: string }) {
  const line = { role: "user", text: LONG, messageId };
  return (
    <article key={chatLineKey("live-1", 0, line.role, line.messageId)}>
      <UserLine text={line.text} />
    </article>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("test_bug_user_line_show_more_key_stable", () => {
  it("keeps Show less when history merge learns a row id", () => {
    expect(chatLineKey("live-1", 0, "user", "")).toBe(chatLineKey("live-1", 0, "user", "row-9"));
    expect(chatLineKey(null, 0, "user", "")).toBe("null-0-user");
    expect(chatLineKey("live-1", 0, "user", "")).not.toBe(chatLineKey("live-2", 0, "user", ""));
    expect(chatLineKey("live-1", 0, "user", "")).not.toBe(chatLineKey("live-1", 1, "user", ""));
    expect(chatLineKey("live-1", 0, "user", "")).not.toBe(chatLineKey("live-1", 0, "assistant", ""));

    const app = readFileSync(path.resolve("src/App.tsx"), "utf8");
    expect(app).toContain("chatLineKey(liveId, index, line.role, line.messageId)");
    const android = readFileSync(
      path.resolve("../android/app/src/main/kotlin/com/hermesbots/phase0/Ui.kt"),
      "utf8",
    );
    expect(android).toContain("chatLineKey(state.liveSessionId, index, line.role, line.messageId)");

    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(240);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(96);

    const view = render(<Transcript messageId="" />);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(screen.getByRole("button", { name: "Show less" })).toBeTruthy();

    view.rerender(<Transcript messageId="row-9" />);
    expect(screen.getByRole("button", { name: "Show less" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
