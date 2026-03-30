/**
 * Planning Extension
 *
 * Commands for creating and executing implementation plans.
 *
 * Commands:
 * - /plan:save [instructions] - Create plan from conversation
 * - /plan:execute - Select and execute a plan
 *
 * Tools:
 * - ask_user - Gather user input through structured multiple-choice questions
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupPlanningCommands } from "./commands";
import { setupPlanningHooks } from "./hooks";

export default function (pi: ExtensionAPI) {
  setupPlanningCommands(pi);
  setupPlanningHooks(pi);
}
