import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface GitPaths {
  repoDir: string;
  gitDir: string;
  commonGitDir: string;
}

export function findGitPaths(cwd: string): GitPaths | null {
  let dir = cwd;

  for (;;) {
    const gitPath = join(dir, ".git");
    if (existsSync(gitPath)) {
      const paths = readGitPaths(dir, gitPath);
      if (paths) return paths;
    }

    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function readDefaultBranch(cwd: string): string | null {
  const paths = findGitPaths(cwd);
  if (!paths) return null;

  const upstream = readUpstreamBranch(paths);
  if (upstream) return upstream;

  const originHead = readRefFile(
    join(paths.commonGitDir, "refs", "remotes", "origin", "HEAD"),
  );
  const originMatch = originHead?.match(/^ref:\s+refs\/remotes\/origin\/(.+)$/);
  if (originMatch?.[1]) return originMatch[1];

  for (const candidate of ["main", "master", "trunk", "develop"]) {
    if (refExists(paths, candidate)) return candidate;
  }

  return null;
}

function readGitPaths(repoDir: string, gitPath: string): GitPaths | null {
  try {
    const stat = statSync(gitPath);
    const gitDir = stat.isFile() ? readGitFile(repoDir, gitPath) : gitPath;
    if (!gitDir) return null;

    const commonDirPath = join(gitDir, "commondir");
    const commonGitDir = existsSync(commonDirPath)
      ? resolve(gitDir, readFileSync(commonDirPath, "utf8").trim())
      : gitDir;

    return { repoDir, gitDir, commonGitDir };
  } catch (_error) {
    void _error;
    return null;
  }
}

function readGitFile(repoDir: string, gitPath: string): string | null {
  const content = readFileSync(gitPath, "utf8").trim();
  if (!content.startsWith("gitdir: ")) return null;
  return resolve(repoDir, content.slice("gitdir: ".length).trim());
}

function readUpstreamBranch(paths: GitPaths): string | null {
  const head = readRefFile(join(paths.gitDir, "HEAD"));
  const branchMatch = head?.match(/^ref:\s+refs\/heads\/(.+)$/);
  if (!branchMatch?.[1]) return null;

  const config = readRefFile(join(paths.commonGitDir, "config"));
  if (!config) return null;

  const section = new RegExp(
    String.raw`\[branch "${escapeRegExp(branchMatch[1])}"\]([\s\S]*?)(?=\n\[|$)`,
  ).exec(config)?.[1];
  if (!section) return null;

  const remote = /^\s*remote\s*=\s*(.+)$/m.exec(section)?.[1]?.trim();
  const merge = /^\s*merge\s*=\s*refs\/heads\/(.+)$/m
    .exec(section)?.[1]
    ?.trim();
  if (remote === "origin" && merge) return merge;

  return null;
}

function refExists(paths: GitPaths, branch: string): boolean {
  if (existsSync(join(paths.commonGitDir, "refs", "heads", branch)))
    return true;

  const packedRefs = readRefFile(join(paths.commonGitDir, "packed-refs"));
  return packedRefs?.includes(` refs/heads/${branch}`) ?? false;
}

function readRefFile(path: string): string | null {
  try {
    return readFileSync(path, "utf8").trim();
  } catch (_error) {
    void _error;
    return null;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
