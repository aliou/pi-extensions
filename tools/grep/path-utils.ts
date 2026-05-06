import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

export function splitSearchPathList(value: string): string[] {
  const paths: string[] = [];
  let current = "";
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        paths.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaped) current += "\\";
  if (current.length > 0) paths.push(current);
  return paths;
}

export function resolveSearchPath(cwd: string, value: string): string {
  let resolvedPath = value;
  if (resolvedPath === "~" || resolvedPath.startsWith("~/")) {
    resolvedPath = resolvedPath.replace(/^~/, homedir());
  }
  return resolve(cwd, resolvedPath);
}

export function resolveSearchPaths(
  cwd: string,
  rawSearchPath: string,
  exists: (path: string) => boolean = existsSync,
): string[] {
  const absoluteSearchPath = resolveSearchPath(cwd, rawSearchPath);
  if (exists(absoluteSearchPath) || !/\s/.test(rawSearchPath)) {
    return [absoluteSearchPath];
  }

  const splitPaths = splitSearchPathList(rawSearchPath);
  const splitAbsolutePaths = splitPaths.map((path) =>
    resolveSearchPath(cwd, path),
  );

  if (
    splitAbsolutePaths.length > 1 &&
    splitAbsolutePaths.every((path) => exists(path))
  ) {
    return splitAbsolutePaths;
  }

  return [absoluteSearchPath];
}
