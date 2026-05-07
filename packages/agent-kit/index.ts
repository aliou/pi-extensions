import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Static, TSchema } from "typebox";
import { SubagentModelResolver } from "./models";
import {
  renderSubagentCall,
  renderSubagentResult,
  SubagentRuntime,
} from "./runtime";
import {
  createResumeSubagentParamsSchema,
  type ResumeSubagentParams,
} from "./schemas";
import { SubagentSessionManager } from "./session-manager";
import { SubagentSessionRecordStore } from "./session-records";
import type { SubagentConfig } from "./types";

export function defineSubagent<Params extends TSchema>(
  pi: ExtensionAPI,
  config: SubagentConfig<Params>,
) {
  const models = new SubagentModelResolver(config.models);
  const records = new SubagentSessionRecordStore(pi);
  const sessions = new SubagentSessionManager(config, models, records);

  const execute = async (
    toolCallId: string,
    params: Static<Params>,
    signal: AbortSignal | undefined,
    onUpdate: Parameters<SubagentRuntime<Params>["execute"]>[2],
    ctx: Parameters<SubagentRuntime<Params>["execute"]>[3],
  ) => {
    const invocationSkills = config.resolveSkills?.(params, ctx) ?? [];
    return sessions.withNewSession(ctx, invocationSkills, async (session) => {
      return new SubagentRuntime(config, session, signal).execute(
        toolCallId,
        params,
        onUpdate,
        ctx,
      );
    });
  };

  const tool = defineTool({
    name: config.name,
    label: config.label,
    description: config.description,
    promptGuidelines: config.promptGuidelines,
    parameters: config.parameters,
    renderCall: (args, theme, ctx) =>
      renderSubagentCall(config, args, theme, ctx),
    renderResult: (result, options, theme, ctx) =>
      renderSubagentResult(config, result, options, theme, ctx),
    execute,
  });

  const resumeTool = defineTool({
    name: `resume_${config.name}`,
    label: `Resume ${config.label}`,
    description: `Resume a previous ${config.label} session using its sessionId`,
    parameters: createResumeSubagentParamsSchema(config.parameters),
    renderCall: (args, theme, ctx) =>
      renderSubagentCall(config, args, theme, ctx),
    renderResult: (result, options, theme, ctx) =>
      renderSubagentResult(config, result, options, theme, ctx),

    async execute(
      toolCallId,
      params: ResumeSubagentParams<Params>,
      signal,
      onUpdate,
      ctx,
    ) {
      const { sessionId, ...restParams } = params;
      const session = await sessions.resume(sessionId, ctx);
      const runtime = new SubagentRuntime<Params>(config, session, signal);
      return runtime.execute(
        toolCallId,
        restParams as Static<Params>,
        onUpdate,
        ctx,
      );
    },
  });

  const subscribe = (pi: ExtensionAPI) => {
    pi.on("session_start", (event, ctx) => {
      sessions.handleSessionStart(event, ctx);
    });

    pi.on("session_shutdown", () => {
      sessions.handleSessionShutdown();
    });
  };

  return { tool, resumeTool, execute, subscribe };
}
