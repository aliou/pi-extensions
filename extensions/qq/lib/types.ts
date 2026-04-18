import type { SubagentUsage } from "../../subagents/lib/types";

export const QQ_MESSAGE_TYPE = "qq";

export type QqDetails = {
  question: string;
  answer: string;
  provider: string;
  model: string;
  timestamp: number;
  usage?: SubagentUsage;
  runId?: string;
  totalDurationMs?: number;
};

/**
 * Registry of QQ message timestamps that are "pending" — added during an
 * active turn and not yet ready for normal rendering.
 *
 * While a message is pending, the custom renderer returns an invisible
 * component and the result is shown in a widget above the editor instead.
 * On the next `turn_start` (or `agent_end`), pending entries are cleared,
 * the widget is removed, and the renderer displays the message normally.
 */
export class QqPendingMessages {
  private pending = new Set<number>();

  add(timestamp: number): void {
    this.pending.add(timestamp);
  }

  has(timestamp: number): boolean {
    return this.pending.has(timestamp);
  }

  clear(): number[] {
    const entries = [...this.pending];
    this.pending.clear();
    return entries;
  }

  get size(): number {
    return this.pending.size;
  }
}

/**
 * Shared singleton — both the command handler and the renderer need
 * access to the same pending state.
 */
export const qqPending = new QqPendingMessages();
