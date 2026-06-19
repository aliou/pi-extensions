---
name: archiving-docs
description: How to archive obsolete documentation without losing history. Use when a doc page is outdated or no longer accurate and should be retired.
---

# Archiving docs

How to retire a doc page without deleting it.

## When to archive
- The page describes a feature, command, or component that no longer exists.
- The page is substantially outdated and a current page already covers the topic.
- The content is wrong enough that updating in place would amount to a rewrite, and a fresh page elsewhere is the source of truth.

Do not archive a page that is merely stale — update it instead.

## How to archive
1. Move the file to `docs/archive/<original-name>`.
2. Preserve the original filename so links and history stay traceable.
3. If the old path is still linked from other docs, leave a one-line pointer at the old location:
   ```markdown
   Archived. See [../archive/old-page.md](../archive/old-page.md).
   ```
4. Remove the archived page from the index in the same change.
5. Add a one-line note at the top of the archived page stating when and why it was archived.

## What not to do
- Do not delete files. History matters.
- Do not leave dangling links. Search for references to the old path and update them.
- Do not archive a page that is still accurate and referenced; update the references instead.

## Bulk archival
When reorganizing removes several pages, archive them together under `docs/archive/<date>/` and note the reason in the index commit.
