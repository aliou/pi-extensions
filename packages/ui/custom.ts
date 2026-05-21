import type { Component, TUI } from "@earendil-works/pi-tui";

export type CustomComponentFactory<TResult> = (
  tui: TUI,
  theme: unknown,
  keybindings: unknown,
  done: (result: TResult) => void,
) =>
  | (Component & { dispose?(): void })
  | Promise<Component & { dispose?(): void }>;
