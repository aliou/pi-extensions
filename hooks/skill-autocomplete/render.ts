import {
  type MessageRenderer,
  parseSkillBlock,
  SkillInvocationMessageComponent,
} from "@earendil-works/pi-coding-agent";

export const SKILL_INVOCATION_MESSAGE_TYPE = "skill-invocation";

export interface SkillInvocationDetails {
  name: string;
  path: string;
}

export const renderSkillInvocation: MessageRenderer<SkillInvocationDetails> = (
  message,
  options,
) => {
  if (typeof message.content !== "string") return undefined;

  const block = parseSkillBlock(message.content);
  if (!block) return undefined;

  const component = new SkillInvocationMessageComponent(block);
  component.setExpanded(options.expanded);
  return component;
};
