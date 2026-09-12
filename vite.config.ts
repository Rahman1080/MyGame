import { defineConfig } from "vitest/config";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [".monkeycode-ai.live"],
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: [".monkeycode-ai.live"],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
