# Local evals

Live model evals use `vitest-evals` with custom harnesses around production subagents. They are separate from unit tests and use the models and credentials in the local Pi configuration.

```sh
pnpm evals
```

Each run writes a new timestamped report under `.vitest-evals/results/`, which is ignored by Git. Reports are retained across full and filtered runs. Inspect all completed runs with:

```sh
pnpm evals:ui
```

The report UI loads the available reports when it starts. Restart it to include runs that finish while it is open.

Model rosters and cases live beside each eval. Session-name fixtures are curated snapshots from real OSS and Pi project sessions. The harness replaces the subagent's production model preferences with a one-model roster, so an unavailable eval model fails instead of falling back to production preferences.

The custom harnesses use `@golevelup/ts-vitest` `createMock` for Pi extension and context objects. Stub only the methods the production path uses, and prefer strict mocks so new runtime dependencies fail visibly.
