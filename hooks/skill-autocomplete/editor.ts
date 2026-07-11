import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { CustomEditor } from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";

const BARE_SKILL_TRIGGER_RE = /(?:^|\s)\?$/;

interface AutocompleteTriggerEditor {
  tryTriggerAutocomplete(): void;
}

class SkillAutocompleteEditor extends CustomEditor {
  override handleInput(data: string): void {
    const textBeforeInput = this.getText();
    super.handleInput(data);

    // Pi only invokes single-character triggers at token boundaries. The
    // second `?` in `??` is not at one, so explicitly start the request after
    // the normal editor has inserted it. `tryTriggerAutocomplete` is private
    // in Pi's types but public at runtime.
    if (
      data === "?" &&
      BARE_SKILL_TRIGGER_RE.test(textBeforeInput) &&
      !this.isShowingAutocomplete()
    ) {
      (this as unknown as AutocompleteTriggerEditor).tryTriggerAutocomplete();
    }
  }
}

export function createSkillAutocompleteEditor(
  tui: TUI,
  theme: EditorTheme,
  keybindings: KeybindingsManager,
): CustomEditor {
  return new SkillAutocompleteEditor(tui, theme, keybindings);
}
