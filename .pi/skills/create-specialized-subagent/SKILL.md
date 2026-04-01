# Create a Specialized Subagent

Use this skill when adding a new specialist to the refactored Pi harness.

This repo uses a **single root entrypoint** (`index.ts`) with subagents defined under `subagents/` and exposed through namespaced root tools such as `subagent.oracle`.

## Goal

Add a new subagent that:

- lives under `subagents/<name>/...`
- is registered in `subagents/index.ts`
- updates shared subagent config in `subagents/config.ts` if needed
- is exposed as a root tool named `subagent.<name>`
- can reuse selected root non-subagent tools through tool catalog plumbing

---

## Checklist

- [ ] Choose a short lowercase name for the subagent
- [ ] Create `subagents/<name>/`
- [ ] Add the subagent prompt/instructions
- [ ] Export/register the subagent in `subagents/index.ts`
- [ ] Update `subagents/config.ts` if the subagent needs shared config or tool catalog changes
- [ ] Expose the callable root tool as `subagent.<name>`
- [ ] Reuse existing root tools via tool catalog plumbing instead of duplicating them
- [ ] Verify root entrypoint wiring still reaches the subagent
- [ ] Update docs if the new specialist should be discoverable by contributors

---

## Recommended workflow

### 1) Pick the role and boundary

Define what the subagent is for in one sentence.

Good examples:
- architecture review
- exploratory repo scanning
- implementation planning
- fast drafting
- adversarial review

Avoid creating a subagent when a normal tool would be enough.

Use a subagent only if the capability needs:
- specialized instructions
- agentic reasoning
- repeated delegated usage

### 2) Create the folder

Create a new folder:

```text
subagents/<name>/
```

Keep the structure minimal. Usually you only need:
- a prompt/instructions file
- optional local helpers or metadata

Example:

```text
subagents/librarian/
  prompt.md
```

### 3) Add the prompt

Write clear instructions for the specialist.

Minimal example:

```md
# Librarian

You are a research-oriented subagent.

Focus on:
- finding relevant code quickly
- summarizing what exists before suggesting changes
- citing exact files and symbols when possible

Do:
- prefer concise findings
- highlight uncertainty
- call out missing context

Do not:
- make broad refactor plans unless asked
- rewrite unrelated areas
```

### 4) Register the subagent in `subagents/index.ts`

Add the new subagent to the registry used by the harness.

Minimal example:

```ts
// subagents/index.ts
import { librarianPrompt } from "./librarian/prompt";

export const subagents = [
  // existing subagents...
  {
    name: "librarian",
    description: "Researches code and summarizes relevant findings.",
    prompt: librarianPrompt,
  },
];
```

Use the same registration pattern already present in the file. Match local conventions instead of inventing a new shape.

### 5) Update shared config in `subagents/config.ts` if needed

If subagents share tool catalog rules, defaults, or common config, add the new subagent there.

Typical reasons to edit `subagents/config.ts`:
- allow the new subagent to see selected shared root tools
- add per-subagent config
- attach defaults used by the registry/tooling

Minimal example:

```ts
// subagents/config.ts
export const subagentToolAccess = {
  // existing entries...
  librarian: [
    "read",
    "find",
    "read_url",
    "get_current_time",
  ],
};
```

Important: prefer reusing existing root non-subagent tools through catalog plumbing. Do not clone tool implementations into the subagent.

### 6) Expose the root tool as `subagent.<name>`

Make the subagent callable through the root tool surface.

Target naming:

```text
subagent.librarian
```

Use the existing subagent tool registration pattern already used for:
- `subagent.scout`
- `subagent.lookout`
- `subagent.oracle`
- `subagent.reviewer`
- `subagent.jester`
- `subagent.worker`

If the repo has a centralized place where subagent tools are declared, add the new entry there instead of creating a one-off registration path.

### 7) Verify root wiring

Confirm the new subagent is reachable from the single root entrypoint:

- `index.ts` loads the root extension graph
- subagent registration is included
- the root tool catalog includes `subagent.<name>`

### 8) Keep docs aligned

If the new subagent is a stable part of the harness, update:
- `subagents/README.md`
- `README.md` if contributor discovery matters

---

## Minimal scaffold example

Use this as a small, adaptable starting point.

### Files

```text
subagents/librarian/prompt.ts
subagents/index.ts
subagents/config.ts
```

### `subagents/librarian/prompt.ts`

```ts
export const librarianPrompt = `
You are Librarian, a specialized research subagent.

Your job:
- inspect the codebase
- find the most relevant files quickly
- summarize findings clearly
- avoid speculative rewrites

Prefer:
- exact file references
- short evidence-backed summaries
- noting uncertainty when context is incomplete
`;
```

### `subagents/index.ts`

```ts
import { librarianPrompt } from "./librarian/prompt";

export const subagents = [
  {
    name: "librarian",
    description: "Finds relevant code and summarizes what exists.",
    prompt: librarianPrompt,
  },
];
```

### `subagents/config.ts`

```ts
export const subagentToolAccess = {
  librarian: ["read", "find", "read_url"],
};
```

### Root tool exposure

Ensure the harness exposes:

```text
subagent.librarian
```

using the same tool registration mechanism as the other `subagent.*` tools.

---

## Guardrails

- Do not add a separate top-level extension entrypoint for the subagent
- Do not register the subagent through hidden side effects
- Do not create a non-namespaced tool like `librarian` at the root
- Do not duplicate root tool logic inside `subagents/`
- Do not skip `subagents/index.ts` registration

---

## Quick decision guide

Create a **subagent** if:
- the task benefits from a specialist persona/instructions
- the work is delegated and bounded
- the capability will be reused

Create a **tool** instead if:
- the behavior is deterministic
- the inputs/outputs are straightforward
- no specialist reasoning is needed

Create a **mode** instead if:
- you want to change session-wide behavior
- the whole harness should operate differently until switched back

---

## Done criteria

A new subagent is complete when:

- it lives under `subagents/<name>/`
- it is registered in `subagents/index.ts`
- any shared config is updated in `subagents/config.ts`
- it is callable as `subagent.<name>`
- it reuses shared root tools through tool catalog plumbing where appropriate
- the root entrypoint architecture remains unchanged
