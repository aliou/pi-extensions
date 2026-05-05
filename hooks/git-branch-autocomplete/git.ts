import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface BranchInfo {
  name: string;
  lastCommitDate: number;
  lastCommitSubject: string;
}

async function listRecentlyAccessedBranches(cwd: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    "git",
    ["reflog", "--format=%gs", "HEAD"],
    { cwd },
  );

  const branches: string[] = [];
  const seen = new Set<string>();

  for (const line of stdout.split("\n")) {
    const match = line.match(/^checkout: moving from .+ to (.+)$/);
    const branch = match?.[1];
    if (branch && !branch.startsWith("-") && !seen.has(branch)) {
      seen.add(branch);
      branches.push(branch);
    }
  }

  return branches;
}

export async function listLocalBranches(cwd: string): Promise<BranchInfo[]> {
  const { stdout } = await execFileAsync(
    "git",
    [
      "for-each-ref",
      "--format=%(refname:short)%09%(committerdate:unix)%09%(contents:subject)",
      "refs/heads",
    ],
    { cwd },
  );

  const branches = stdout
    .split("\n")
    .map((line) => {
      const [name, lastCommitDate = "0", ...subjectParts] = line.split("\t");
      return {
        name: name?.trim() ?? "",
        lastCommitDate: Number(lastCommitDate) * 1000,
        lastCommitSubject: subjectParts.join("\t").trim(),
      };
    })
    .filter((branch) => branch.name);

  const accessedBranches = await listRecentlyAccessedBranches(cwd);
  const accessedOrder = new Map(
    accessedBranches.map((branch, index) => [branch, index]),
  );

  return [...branches].sort((a: BranchInfo, b: BranchInfo) => {
    const aOrder = accessedOrder.get(a.name);
    const bOrder = accessedOrder.get(b.name);

    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;

    return a.name.localeCompare(b.name);
  });
}
