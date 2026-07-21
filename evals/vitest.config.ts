import { defineConfig } from "vitest/config";

const runId = `${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${process.pid}`;

export default defineConfig({
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: ["vitest-evals/reporter", "json"],
    outputFile: { json: `.vitest-evals/results/${runId}.json` },
  },
});
