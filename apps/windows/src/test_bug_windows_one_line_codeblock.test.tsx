import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Reply } from "./markdown";

afterEach(() => {
  cleanup();
});

describe("test_bug_windows_one_line_codeblock", () => {
  it("renders a one-line fence without a language as a code card labeled text", () => {
    const { container } = render(<Reply text={'```\necho "hello"\n```'} />);
    const card = container.querySelector(".fence");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("text")).toBeTruthy();
    expect(within(card as HTMLElement).getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(card?.textContent).toContain('echo "hello"');
  });

  it("renders a one-line fence with a language label", () => {
    const { container } = render(<Reply text={'```bash\necho "hello"\n```'} />);
    const card = container.querySelector(".fence");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("bash")).toBeTruthy();
    expect(within(card as HTMLElement).getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("keeps inline code inline without a code card", () => {
    const { container } = render(<Reply text="Use `npm test` here." />);
    expect(container.querySelector(".fence")).toBeNull();
    const inline = screen.getByText("npm test");
    expect(inline.tagName).toBe("CODE");
  });
});