/** Check if user message text references any image files. */
export function referencesImageFiles(text: string): boolean {
  return /\.(?:png|jpe?g|gif|webp|bmp|svg)(?:[\s"'`,;)\]\\]|$)/i.test(text);
}
