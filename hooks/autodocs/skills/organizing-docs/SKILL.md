---
name: organizing-docs
description: Directory layout, naming, and index conventions for a project's docs. Use when deciding where a doc page should live or restructuring the docs tree.
---

# Organizing docs

How the docs directory is laid out and named.

## Directory layout
Prefer a flat, predictable structure that mirrors how readers look things up, not how the source is organized:

```
docs/
  getting-started.md        # first thing a new reader needs
  architecture.md           # high-level system overview
  commands/                 # user-facing commands
  tools/                    # agent-callable tools
  hooks/                    # extension hooks
  packages/                 # internal workspace packages
  workflows/                # repeatable processes (release, testing, etc.)
  archive/                  # obsolete pages kept for history
```

## Naming
- Use `kebab-case.md` for files.
- Name pages by the concept, not the file path. `autodocs.md`, not `hooks-autodocs-index-ts.md`.
- One concept per page.

## Index and navigation
- Keep an index at `docs/README.md` (or `docs/index.md`) listing every page by section.
- When adding a page, add it to the index in the same change.
- Keep section groupings to 3–7 items; split sections that grow beyond that.

## When to reorganize
- When a reader would struggle to find a topic that exists.
- When two pages cover the same concept (merge, redirect via a one-line pointer, or archive the older).
- When a section has a single orphan page (fold it into its parent or rename the section).

## Archival vs deletion
- Never delete a doc. Move obsolete pages to `docs/archive/`.
- Leave a one-line pointer at the old location only if it is still linked from elsewhere.
