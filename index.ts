import breadcrumbs from "@extensions/breadcrumbs";
import btw from "@extensions/btw";
import defaults from "@extensions/defaults";
import editor from "@extensions/editor";
import palette from "@extensions/palette";
import planning from "@extensions/planning";
import providers from "@extensions/providers";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import modes from "@modes/index";
import subagents from "@subagents/index";
import { setupRootTools } from "@/tools";

export default async function (pi: ExtensionAPI): Promise<void> {
  await defaults(pi);
  await editor(pi);
  await providers(pi);
  await planning(pi);
  await breadcrumbs(pi);
  await btw(pi);
  await palette(pi);
  await modes(pi);
  await subagents(pi);
  await setupRootTools(pi);
}
