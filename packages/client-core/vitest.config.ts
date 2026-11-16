import { defineConfig } from "vitest/config";

// The tests start real servers, each with its own bots, so they run in separate processes.
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
  },
});
