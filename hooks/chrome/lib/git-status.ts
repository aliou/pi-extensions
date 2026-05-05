/**
 * Async git status watcher for the footer.
 *
 * Watches `.git/index` and ref directories for changes, then runs
 * lightweight git commands to resolve dirty and ahead/behind state.
 * Results are cached; the footer reads from cache synchronously.
 *
 * Architecture mirrors the upstream FooterDataProvider: file watching
 * for triggers, async git commands for data, debounced refresh.
 */

import { type ExecFileException, execFile } from "node:child_process";
import {
  existsSync,
  type FSWatcher,
  readFileSync,
  statSync,
  watch,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface GitStatus {
  /** Working tree or index has changes. */
  dirty: boolean;
  /** Commits ahead of upstream. 0 if in sync or no upstream. */
  ahead: number;
  /** Commits behind upstream. 0 if in sync or no upstream. */
  behind: number;
}

const EMPTY_STATUS: GitStatus = { dirty: false, ahead: 0, behind: 0 };
const DEBOUNCE_MS = 500;

interface GitPaths {
  repoDir: string;
  commonGitDir: string;
}

function findGitPaths(cwd: string): GitPaths | null {
  let dir = cwd;
  for (;;) {
    const gitPath = join(dir, ".git");
    if (existsSync(gitPath)) {
      try {
        const stat = statSync(gitPath);
        if (stat.isFile()) {
          const content = readFileSync(gitPath, "utf8").trim();
          if (content.startsWith("gitdir: ")) {
            const gitDir = resolve(dir, content.slice(8).trim());
            const commonDirPath = join(gitDir, "commondir");
            const commonGitDir = existsSync(commonDirPath)
              ? resolve(gitDir, readFileSync(commonDirPath, "utf8").trim())
              : gitDir;
            return { repoDir: dir, commonGitDir };
          }
        } else if (stat.isDirectory()) {
          return { repoDir: dir, commonGitDir: gitPath };
        }
      } catch {
        return null;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function gitExecAsync(
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string }> {
  return new Promise((res) => {
    execFile(
      "git",
      ["--no-optional-locks", ...args],
      { cwd, encoding: "utf8" },
      (err: ExecFileException | null, stdout: string) => {
        const exitCode = err ? 1 : 0;
        res({ code: exitCode, stdout: stdout ?? "" });
      },
    );
  });
}

/**
 * Watches git state and provides cached dirty/ahead/behind info.
 * Call `getStatus()` synchronously from render; call `dispose()` on cleanup.
 */
export class GitStatusWatcher {
  private gitPaths: GitPaths | null;
  private cached: GitStatus = { ...EMPTY_STATUS };
  private disposed = false;

  private indexWatcher: FSWatcher | null = null;
  private refsWatcher: FSWatcher | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshInFlight = false;
  private refreshPending = false;

  private onChange: () => void;

  constructor(cwd: string, onChange: () => void) {
    this.onChange = onChange;
    this.gitPaths = findGitPaths(cwd);
    this.setupWatchers();
    // Initial async fetch
    this.scheduleRefresh();
  }

  /** Synchronous read from cache. */
  getStatus(): Readonly<GitStatus> {
    return this.cached;
  }

  /** Update cwd (e.g. after session switch). */
  setCwd(cwd: string): void {
    this.teardownWatchers();
    this.cached = { ...EMPTY_STATUS };
    this.gitPaths = findGitPaths(cwd);
    this.setupWatchers();
    this.scheduleRefresh();
  }

  dispose(): void {
    this.disposed = true;
    this.teardownWatchers();
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private teardownWatchers(): void {
    if (this.indexWatcher) {
      this.indexWatcher.close();
      this.indexWatcher = null;
    }
    if (this.refsWatcher) {
      this.refsWatcher.close();
      this.refsWatcher = null;
    }
  }

  private setupWatchers(): void {
    if (!this.gitPaths) return;
    const { commonGitDir } = this.gitPaths;

    // Watch the directory containing the index file.
    // Git rewrites the index atomically (write temp, rename), so
    // watching the directory catches inode changes.
    try {
      this.indexWatcher = watch(commonGitDir, (_eventType, filename) => {
        const name = filename?.toString();
        if (!name || name === "index" || name === "index.lock") {
          this.scheduleRefresh();
        }
      });
    } catch {
      // Not a git repo or permission issue
    }

    // Watch refs directory for push/pull/fetch changes (ahead/behind).
    const refsDir = join(commonGitDir, "refs");
    if (existsSync(refsDir)) {
      try {
        this.refsWatcher = watch(refsDir, { recursive: true }, () => {
          this.scheduleRefresh();
        });
      } catch {
        // Silently fail
      }
    }
  }

  private scheduleRefresh(): void {
    if (this.disposed || this.refreshTimer) return;
    if (this.refreshInFlight) {
      this.refreshPending = true;
      return;
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh();
    }, DEBOUNCE_MS);
  }

  private async refresh(): Promise<void> {
    if (this.disposed || !this.gitPaths) return;
    if (this.refreshInFlight) {
      this.refreshPending = true;
      return;
    }

    this.refreshInFlight = true;
    try {
      const [dirty, aheadBehind] = await Promise.all([
        this.fetchDirty(),
        this.fetchAheadBehind(),
      ]);
      if (this.disposed) return;

      const next: GitStatus = {
        dirty,
        ahead: aheadBehind.ahead,
        behind: aheadBehind.behind,
      };

      if (
        next.dirty !== this.cached.dirty ||
        next.ahead !== this.cached.ahead ||
        next.behind !== this.cached.behind
      ) {
        this.cached = next;
        this.onChange();
      }
    } finally {
      this.refreshInFlight = false;
      if (this.refreshPending && !this.disposed) {
        this.refreshPending = false;
        this.scheduleRefresh();
      }
    }
  }

  private async fetchDirty(): Promise<boolean> {
    if (!this.gitPaths) return false;
    // -u no limits untracked file search; we only need to know if *anything* changed.
    // Using --porcelain for stable output; piping through head -1 equivalent via
    // checking if stdout is non-empty.
    const { stdout } = await gitExecAsync(
      ["status", "--porcelain", "-uno"],
      this.gitPaths.repoDir,
    );
    return stdout.trim().length > 0;
  }

  private async fetchAheadBehind(): Promise<{
    ahead: number;
    behind: number;
  }> {
    if (!this.gitPaths) return { ahead: 0, behind: 0 };
    const { code, stdout } = await gitExecAsync(
      ["rev-list", "--count", "--left-right", "@{upstream}...HEAD"],
      this.gitPaths.repoDir,
    );
    if (code !== 0) return { ahead: 0, behind: 0 };
    const parts = stdout.trim().split(/\s+/);
    return {
      behind: Number.parseInt(parts[0] ?? "0", 10) || 0,
      ahead: Number.parseInt(parts[1] ?? "0", 10) || 0,
    };
  }
}
