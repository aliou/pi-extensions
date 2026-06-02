import type {
  AgentSession,
  AgentSessionEvent,
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isBlank } from "@harness/utils";
import type { Optional } from "@harness/utils/types";
import type { Static, TSchema } from "typebox";
import type { SubagentConfig } from "../types";
import { appendSubagentSessionFooter, textContent } from "./content";
import { SubagentRuntimeState } from "./runtime-state";
import { formatSubagentStatus } from "./status";
import type { SubagentDetails } from "./types";

export class SubagentRuntime<Params extends TSchema = TSchema> {
  private unsubscribe?: () => void;
  private state: SubagentRuntimeState;

  constructor(
    private config: SubagentConfig<Params>,
    private session: AgentSession,
    private signal: Optional<AbortSignal>,
  ) {
    this.signal = signal;
    this.signal?.addEventListener?.("abort", this.onAbort);
    this.state = new SubagentRuntimeState(config, session);
  }

  async execute(
    _toolCallId: string,
    params: Static<Params>,
    onUpdate: Optional<AgentToolUpdateCallback<SubagentDetails>>,
    ctx: ExtensionContext,
  ): Promise<AgentToolResult<SubagentDetails>> {
    try {
      this.signal?.throwIfAborted();
      const promptResult = this.config.buildPrompt(params, ctx);
      this.state.setPrompt(promptResult.text);
      this.state.setParams(params);
      this.unsubscribe = this.session.subscribe((event) => {
        this.handleEvent(event, onUpdate);
      });

      if (this.config.beforeExecute) {
        try {
          await this.config.beforeExecute(params, this.session, ctx);
        } catch (err) {
          throw new Error(`An error occureed during \`beforeExecute\`: ${err}`);
        }
      }

      await this.session.prompt(promptResult.text, {
        images: promptResult.images,
      });

      if (this.signal?.aborted) {
        this.state.markAborted();
        throw new Error(this.state.value.error ?? "Subagent aborted");
      }

      const response = this.session.getLastAssistantText();
      if (isBlank(response)) {
        this.state.markEmptyResponse();
      } else {
        this.state.markSuccess(response);
      }

      const content = this.config.resumable
        ? appendSubagentSessionFooter(
            response ?? "",
            this.config.name,
            this.session.sessionId,
          )
        : (response ?? "");

      return {
        content: [textContent(content)],
        details: this.state.snapshot(),
      };
    } catch (err: unknown) {
      if (this.signal?.aborted) {
        this.state.markAborted();
        throw new Error(this.state.value.error ?? "Subagent aborted");
      }

      if (err instanceof Error) {
        this.state.markError(err.message);
      } else {
        this.state.markError("Unknown error");
      }

      throw new Error(this.state.value.error ?? "Unknown error");
    } finally {
      if (this.signal && !this.signal.aborted) {
        this.signal.removeEventListener("abort", this.onAbort);
      }

      this.unsubscribe?.();
      this.session.dispose();
    }
  }

  private handleEvent(
    event: AgentSessionEvent,
    onUpdate: Optional<AgentToolUpdateCallback<SubagentDetails>>,
  ) {
    const changed = this.state.applyEvent(event);
    if (!changed) return;

    this.emitUpdate(onUpdate);
  }

  private emitUpdate(
    onUpdate?: Optional<AgentToolUpdateCallback<SubagentDetails>>,
  ) {
    onUpdate?.({
      content: [textContent(formatSubagentStatus(this.state.value))],
      details: this.state.snapshot(),
    });
  }

  private onAbort = () => {
    this.unsubscribe?.();
    this.session.abort();
  };
}
