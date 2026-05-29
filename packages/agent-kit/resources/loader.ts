import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createExtensionRuntime,
  DefaultPackageManager,
  discoverAndLoadExtensions,
  getAgentDir,
  type LoadExtensionsResult,
  type PromptTemplate,
  type ResourceDiagnostic,
  type ResourceLoader,
  SettingsManager,
  type Skill,
  type Theme,
} from "@earendil-works/pi-coding-agent";

export class SubagentResourceLoader implements ResourceLoader {
  private extensionsResult: LoadExtensionsResult = {
    extensions: [],
    errors: [],
    runtime: createExtensionRuntime(),
  };

  private appendSystemPrompt: string[] = [];

  constructor(
    private cwd: string,
    private systemPrompt: string,
    private skills: Skill[],
    private extensionPaths: string[] = [],
    private packageAgentDir: string = getAgentDir(),
  ) {}

  getExtensions(): LoadExtensionsResult {
    return this.extensionsResult;
  }

  getSkills(): { skills: Skill[]; diagnostics: ResourceDiagnostic[] } {
    return { skills: this.skills, diagnostics: [] };
  }

  getPrompts(): {
    prompts: PromptTemplate[];
    diagnostics: ResourceDiagnostic[];
  } {
    return { prompts: [], diagnostics: [] };
  }

  getThemes(): { themes: Theme[]; diagnostics: ResourceDiagnostic[] } {
    return { themes: [], diagnostics: [] };
  }

  getAgentsFiles(): { agentsFiles: Array<{ path: string; content: string }> } {
    return { agentsFiles: [] };
  }

  getSystemPrompt(): string | undefined {
    return this.systemPrompt;
  }

  getAppendSystemPrompt(): string[] {
    return this.appendSystemPrompt;
  }

  /**
   * Set extra lines to append to the system prompt.
   *
   * Must be called after reload() so that extension tool promptGuidelines
   * can be collected from the loaded extensions.
   */
  setAppendSystemPrompt(lines: string[]): void {
    this.appendSystemPrompt = lines;
  }

  extendResources() {}

  async reload(): Promise<void> {
    const extensionPaths = await this.resolveExtensionPaths();

    this.extensionsResult = await discoverAndLoadExtensions(
      extensionPaths,
      this.cwd,
      this.packageAgentDir,
    );
  }

  private async resolveExtensionPaths(): Promise<string[]> {
    const localPaths: string[] = [];
    const packageSources: string[] = [];

    for (const extensionPath of this.extensionPaths) {
      if (isPackageSource(extensionPath)) {
        packageSources.push(extensionPath);
        continue;
      }

      localPaths.push(this.resolveLocalExtensionPath(extensionPath));
    }

    if (packageSources.length === 0) {
      return localPaths;
    }

    const packageManager = new DefaultPackageManager({
      cwd: this.cwd,
      agentDir: this.packageAgentDir,
      settingsManager: SettingsManager.create(this.cwd, this.packageAgentDir),
    });
    const resolved =
      await packageManager.resolveExtensionSources(packageSources);
    const packageExtensionPaths = resolved.extensions
      .filter((extension) => extension.enabled)
      .map((extension) => extension.path);

    return [...localPaths, ...packageExtensionPaths];
  }

  private resolveLocalExtensionPath(extensionPath: string): string {
    if (path.isAbsolute(extensionPath)) return extensionPath;
    if (extensionPath.startsWith("~") || extensionPath.startsWith("file:")) {
      return extensionPath;
    }
    return path.resolve(getHarnessPackageRoot(), extensionPath);
  }
}

let harnessPackageRoot: string | undefined;

function getHarnessPackageRoot(): string {
  harnessPackageRoot ??= findHarnessPackageRoot();
  return harnessPackageRoot;
}

function findHarnessPackageRoot(): string {
  let current = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    const packageJsonPath = path.join(current, "package.json");
    if (existsSync(packageJsonPath) && isHarnessPackageRoot(packageJsonPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) return path.dirname(fileURLToPath(import.meta.url));
    current = parent;
  }
}

function isHarnessPackageRoot(packageJsonPath: string): boolean {
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
      pi?: { extensions?: unknown };
    };
    return Array.isArray(packageJson.pi?.extensions);
  } catch (_error) {
    void _error;
    return false;
  }
}

function isPackageSource(extensionPath: string): boolean {
  return extensionPath.startsWith("npm:") || extensionPath.startsWith("git:");
}
