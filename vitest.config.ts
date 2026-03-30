import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve("."),
      "@packages": resolve("packages"),
      "@extensions": resolve("extensions"),
      "@modes": resolve("modes"),
      "@subagents": resolve("subagents"),
      // Internal pi-coding-agent module not exposed via package "exports".
      // Mapped here so tests can import it; the single wrapper in
      // tests/utils/load-extension.ts is the only consumer.
      "#pi-internal/extensions-loader": resolve(
        "node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/loader.js",
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "extensions/**/*.test.ts",
      "packages/**/*.test.ts",
      "modes/**/*.test.ts",
      "subagents/**/*.test.ts",
      "tools/**/*.test.ts",
    ],
    setupFiles: ["./tests/vitest.setup.ts"],
    mockReset: true,
  },
});
