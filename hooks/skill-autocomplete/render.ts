import {
  keyText,
  type MessageRenderer,
  parseSkillBlock,
} from "@earendil-works/pi-coding-agent";
import { SkillInvocationMessageComponent } from "@harness/ui";
import { parseSkillDescription } from "@harness/utils";

export const SKILL_INVOCATION_MESSAGE_TYPE = "skill-invocation";

export interface SkillInvocationDetails {
  name: string;
  path: string;
  description?: string;
}

export const renderSkillInvocation: MessageRenderer<SkillInvocationDetails> = (
  message,
  options,
  theme,
) => {
  if (typeof message.content !== "string") return undefined;

  const block = parseSkillBlock(message.content);
  if (!block) return undefined;

  return new SkillInvocationMessageComponent({
    name: block.name,
    content: block.content,
    description:
      message.details?.description ??
      parseSkillDescription(block.content) ??
      undefined,
    expanded: options.expanded,
    expandHint: keyText("app.tools.expand"),
    theme,
  });
};
