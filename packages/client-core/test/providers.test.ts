import type { ProviderLogin } from "@botsman/protocol";
import { describe, expect, it } from "vitest";
import { effortChoices, loginView, modelProblem, shownEffort } from "../src/index.ts";

const login = (change: Partial<ProviderLogin>): ProviderLogin => ({ id: "l1", providerId: "p", status: "running", steps: [], pendingPrompt: null, error: null, ...change });

describe("sign-in view", () => {
  it("shows the newest address, the waiting question, and the latest progress", () => {
    const view = loginView(
      login({
        steps: [
          { type: "auth_url", url: "https://old.example", instructions: null },
          { type: "auth_url", url: "https://new.example", instructions: "Sign in, then paste the code." },
          { type: "prompt", promptId: "q1", kind: "manual_code", message: "Paste the code", placeholder: null, options: [] },
          { type: "progress", message: "Waiting for the browser" },
        ],
        pendingPrompt: "q1",
      }),
    );
    expect(view.link).toEqual({ url: "https://new.example", instructions: "Sign in, then paste the code." });
    expect(view.prompt?.promptId).toBe("q1");
    expect(view.progress).toBe("Waiting for the browser");
    expect(view.outcome).toBe("running");
  });

  it("hides an answered question and reports how it ended", () => {
    const view = loginView(login({ status: "succeeded", steps: [{ type: "prompt", promptId: "q1", kind: "text", message: "Name", placeholder: null, options: [] }] }));
    expect(view.prompt).toBeUndefined();
    expect(view.outcome).toBe("connected");
  });
});

describe("model problems", () => {
  const models = [{ provider: "a", id: "m1", name: "M1", contextWindow: 1000, reasoning: false }];

  it("explains why a chat can't run", () => {
    expect(modelProblem([], null)).toMatch(/Connect a model provider/);
    expect(modelProblem(models, null)).toMatch(/Choose a model/);
    expect(modelProblem(models, { provider: "b", modelId: "gone" })).toMatch(/isn't available/);
    expect(modelProblem(models, { provider: "a", modelId: "m1" })).toBeUndefined();
  });

  it("offers only Off for a model without reasoning", () => {
    expect(effortChoices(models[0])).toEqual(["off"]);
  });

  it("offers the levels the server lists, and marks the level a chat really runs at", () => {
    const model = { provider: "a", id: "m2", name: "M2", contextWindow: 1000, reasoning: true, thinkingLevels: ["off", "low", "high"] as ("off" | "low" | "high")[] };
    expect(effortChoices(model)).toEqual(["off", "low", "high"]);
    expect(shownEffort(model, "medium")).toBe("high");
    expect(shownEffort(model, "max")).toBe("high");
    expect(shownEffort(model, "low")).toBe("low");
  });
});
