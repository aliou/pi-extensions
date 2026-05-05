/**
 * Remove terminal escape/control sequences that leak into tool output UI.
 * Mirrors native bash rendering behavior in pi-mono (strip + sanitize).
 */

const ESC = "\u001B";
const OSC_REGEX = new RegExp(`${ESC}\\][\\s\\S]*?(?:\\u0007|${ESC}\\\\)`, "g");
const CSI_REGEX = new RegExp(`${ESC}\\[[0-?]*[ -/]*[@-~]`, "g");
const SINGLE_ESC_REGEX = new RegExp(`${ESC}[@-_]`, "g");
const C1_ST_REGEX = /\u009C/g;

export function sanitizeShellOutput(value: string): string {
  let text = value;

  // OSC sequences: ESC ] ... BEL or ESC \\
  text = text.replace(OSC_REGEX, "");
  // CSI/SGR and other control sequences: ESC [ ... command
  text = text.replace(CSI_REGEX, "");
  // Other single-character escapes
  text = text.replace(SINGLE_ESC_REGEX, "");
  // Standalone String Terminator and leftover ESC
  text = text.replace(C1_ST_REGEX, "").replace(new RegExp(ESC, "g"), "");

  // Drop control chars except tab/newline/carriage return.
  return Array.from(text)
    .filter((char) => {
      const code = char.codePointAt(0);
      if (code === undefined) return false;
      if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
      return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
    })
    .join("");
}
