import * as fs from "node:fs";
import * as path from "node:path";

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, "");
}

export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
  return `${Math.round(count / 1000000)}M`;
}

export function getGitBranch(cwd: string): string | null {
  try {
    let dir = cwd;
    while (dir !== "/") {
      const gitPath = path.join(dir, ".git");
      if (fs.existsSync(gitPath)) {
        const stat = fs.statSync(gitPath);
        let headPath: string;

        if (stat.isFile()) {
          const content = fs.readFileSync(gitPath, "utf8").trim();
          if (content.startsWith("gitdir: ")) {
            const gitDir = content.slice(8);
            headPath = path.resolve(dir, gitDir, "HEAD");
          } else {
            return null;
          }
        } else {
          headPath = path.join(gitPath, "HEAD");
        }

        if (fs.existsSync(headPath)) {
          const content = fs.readFileSync(headPath, "utf8").trim();
          if (content.startsWith("ref: refs/heads/")) {
            return content.slice(16);
          }
          return "detached";
        }
      }
      dir = path.dirname(dir);
    }
  } catch {
    // Ignore errors
  }
  return null;
}

export function getPiVersion(): string {
  try {
    const packageJsonPath = path.resolve(
      import.meta.dirname,
      "../../package.json",
    );
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return (
      packageJson.devDependencies?.["@mariozechner/pi-coding-agent"] ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}
