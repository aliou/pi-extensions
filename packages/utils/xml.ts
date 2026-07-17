/**
 * Escape the five XML special characters (`&`, `<`, `>`, `"`, `'`).
 *
 * Mirrors Pi's internal `escapeXml` (`core/skills.ts`), which is not exported.
 * Keep this in sync with Pi's implementation so values rendered into Pi's
 * XML-wrapped prompt sections (e.g. `<project_instructions path="...">`)
 * escape identically.
 */
export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
