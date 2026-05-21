// biome-ignore lint/plugin: direct child_process usage is required to hand stdio to $EDITOR.
import { spawnSync } from "node:child_process";
import type { Component, TUI } from "@earendil-works/pi-tui";
import type { CustomComponentFactory } from "./custom";

export function getEditor(): string {
  return process.env.VISUAL || process.env.EDITOR || "nvim";
}

export class ExternalEditorComponent implements Component {
  static create(file: string): CustomComponentFactory<number | null> {
    return (tui, _theme, _keybindings, done) =>
      new ExternalEditorComponent(tui, file, done);
  }

  constructor(
    private readonly tui: TUI,
    private readonly file: string,
    private readonly done: (exitCode: number | null) => void,
  ) {
    // Pi mounts custom components from a Promise continuation. Queueing our
    // editor launch here makes it run before the component is mounted today,
    // so render() is not expected to be visible. If Pi changes that ordering,
    // render() may need an explicit empty/loading state instead.
    queueMicrotask(() => this.run());
  }

  render(): string[] {
    return [];
  }

  invalidate(): void {}

  private run(): void {
    let result: number | null = 1;
    this.tui.stop();

    try {
      const editorResult = spawnSync(getEditor(), [this.file], {
        stdio: "inherit",
        env: process.env,
      });

      result = editorResult.status;
    } finally {
      this.tui.start();
      this.tui.requestRender(true);
      this.done(result);
    }
  }
}
