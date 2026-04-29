import {
  createExtensionRuntime,
  discoverAndLoadExtensions,
  type LoadExtensionsResult,
  type PromptTemplate,
  type ResourceDiagnostic,
  type ResourceLoader,
  type Skill,
  type Theme,
} from "@mariozechner/pi-coding-agent";

export class SubagentResourceLoader implements ResourceLoader {
  private extensionsResult: LoadExtensionsResult = {
    extensions: [],
    errors: [],
    runtime: createExtensionRuntime(),
  };

  constructor(
    private cwd: string,
    private agentDir: string,
    private systemPrompt: string,
    private skills: Skill[],
    private extensionPaths: string[] = [],
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
    return [];
  }

  extendResources() {}

  async reload(): Promise<void> {
    this.extensionsResult = await discoverAndLoadExtensions(
      this.extensionPaths,
      this.cwd,
      this.agentDir,
    );
  }
}
