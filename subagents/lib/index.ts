/**
 * Specialized subagents library.
 */

// API clients
export {
  createGitHubClient,
  GitHubClient,
  type GitHubComment,
  type GitHubDirectoryItem,
  type GitHubFileContent,
  type GitHubIssue,
  type GitHubLabel,
  type GitHubPullRequest,
  type GitHubReadme,
  type GitHubRepository,
  type GitHubUser,
  type ParsedGitHubUrl,
  parseGitHubUrl,
} from "@subagents/lib/clients";
// Error classification
export {
  isModelAvailabilityError,
  shouldFailToolCallForModelIssue,
} from "@subagents/lib/error-classification";
// Core executor
export { executeSubagent, filterThinkingTags } from "@subagents/lib/executor";
// Logging
export {
  createRunLogger,
  generateRunId,
  getLogDirectory,
  type RunLogger,
  sanitizePath,
} from "@subagents/lib/logging";
// Model resolution
export { resolveModel } from "@subagents/lib/model-resolver";
// Path utilities
export { shortenPath } from "@subagents/lib/paths";
// Skills
export {
  type ResolveSkillsResult,
  resolveSkillsByName,
} from "@subagents/lib/skills";
// Types
export type {
  BaseSubagentDetails,
  OnTextUpdate,
  OnToolUpdate,
  SubagentConfig,
  SubagentResponseDetails,
  SubagentResult,
  SubagentSkillDetails,
  SubagentToolCall,
  SubagentToolCallDetails,
  SubagentUsage,
} from "@subagents/lib/types";
// UI
export {
  formatCost,
  formatSubagentStats,
  formatTokenCount,
  formatToolCallCompact,
  formatToolCallExpanded,
  getCurrentRunningTool,
  INDICATOR,
  type ModelRef,
  pluralize,
  renderDoneResult,
  renderStreamingStatus,
  renderSubagentCallHeader,
} from "@subagents/lib/ui";
