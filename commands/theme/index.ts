import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { SelectItem } from "@earendil-works/pi-tui";
import {
  AD_HEADER_COLLECT_EVENT,
  AD_HEADER_REGISTER_COMMAND_EVENT,
} from "@harness/events";
import { ThemeSelector } from "./components/theme-selector";

export default async function (pi: ExtensionAPI) {
  pi.registerCommand("theme", {
    description: "Select theme with preview",
    handler: async (_args, ctx) => {
      const allThemes = ctx.ui.getAllThemes();
      if (allThemes.length === 0) {
        ctx.ui.notify("No themes available", "warning");
        return;
      }

      // Store original theme to restore on cancel
      const originalTheme = ctx.ui.theme;

      // Find current theme index
      let currentIndex = 0;
      for (const [i, t] of allThemes.entries()) {
        const loadedTheme = ctx.ui.getTheme(t.name);
        if (loadedTheme === originalTheme) {
          currentIndex = i;
          break;
        }
      }

      const options: SelectItem[] = allThemes.map((t) => ({
        value: t.name,
        label: t.name,
        description: t.path ? "Custom" : "Built-in",
      }));

      let selected: string | null | undefined = await ctx.ui.custom<
        string | null
      >((_tui, _theme, _keybindings, done) => {
        return new ThemeSelector(
          options,
          currentIndex,
          (value) => {
            ctx.ui.setTheme(value);
            done(value);
          },
          () => {
            ctx.ui.setTheme(originalTheme);
            done(null);
          },
          (value) => ctx.ui.setTheme(value),
        );
      });

      // RPC fallback: use select dialog
      if (selected === undefined) {
        const themeNames = allThemes.map((t) => t.name);
        selected = await ctx.ui.select("Select theme", themeNames);
        if (selected) {
          ctx.ui.setTheme(selected);
        }
      }

      if (selected) {
        ctx.ui.notify(`Theme: ${selected}`, "info");
      }
    },
  });

  const off = pi.events.on(AD_HEADER_COLLECT_EVENT, () => {
    off();
    pi.events.emit(AD_HEADER_REGISTER_COMMAND_EVENT, {
      name: "theme",
      description: "cycle color theme",
    });
  });
}
