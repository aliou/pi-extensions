---
name: writing-docs
description: Conventions for writing project documentation — voice, structure, frontmatter, and cross-linking. Use when creating or updating a doc page.
---

# Writing docs

How to write a doc page in this project's docs directory.

## Voice and style
- Write in complete, clear sentences. Like a senior developer talking to a junior developer.
- Be concrete and specific. Name the file, the function, the flag. Avoid vague advice.
- Keep paragraphs short. Lead with the conclusion or the action.
- Explain the "why" before the "how".

## Structure
Every doc page should answer, in order:
1. What this is (one sentence).
2. Why it exists / when to use it.
3. How it works (the important parts, with short code or command examples).
4. Related docs (cross-links).

## Frontmatter
Use minimal YAML frontmatter only when it carries real metadata (title, tags, status). Do not add frontmatter for decoration.

```markdown
---
title: Autodocs
status: active
---
```

## Code and commands
- Keep examples runnable. Show the exact command or snippet the reader would use.
- Label blocks with the language.
- Prefer showing the command and its expected output over prose description.

## Cross-linking
- Link to related docs with relative paths: `[setup](../getting-started.md)`.
- Link out to source only when a doc references a specific implementation detail worth reading in place.
- Do not duplicate content that lives elsewhere; link to it.

## Length
- A page should be as short as possible while remaining complete.
- Split a page when it exceeds ~300 lines or covers two distinct concerns.
