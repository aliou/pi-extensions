import { existsSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type AlertSound = "attention" | "success" | "error";

interface PlatformAudioConfig {
  binaries: readonly string[];
  sounds: Readonly<Record<AlertSound, string>>;
}

export interface PlayAlertSoundOptions {
  prependBinaries?: readonly string[];
}

const DARWIN_AUDIO_CONFIG: PlatformAudioConfig = {
  binaries: ["afplay"],
  sounds: {
    attention: "/System/Library/Sounds/Glass.aiff",
    success: "/System/Library/Sounds/Funk.aiff",
    error: "/System/Library/Sounds/Basso.aiff",
  },
};

function platformConfig(): PlatformAudioConfig | undefined {
  if (process.platform === "darwin") return DARWIN_AUDIO_CONFIG;
  return undefined;
}

function shouldSkipBinary(binary: string): boolean {
  return binary.startsWith("/") && !existsSync(binary);
}

export async function playSoundFile(
  exec: ExtensionAPI["exec"],
  soundPath: string,
  options: PlayAlertSoundOptions = {},
): Promise<void> {
  const config = platformConfig();
  if (!config) return;

  const binaries = [...(options.prependBinaries ?? []), ...config.binaries];
  for (const binary of binaries) {
    if (shouldSkipBinary(binary)) continue;

    try {
      await exec(binary, [soundPath]);
      return;
    } catch (_error) {
      void _error;
    }
  }
}

export async function playAlertSound(
  exec: ExtensionAPI["exec"],
  sound: AlertSound,
  options: PlayAlertSoundOptions = {},
): Promise<void> {
  const config = platformConfig();
  if (!config) return;

  const soundPath = config.sounds[sound];
  await playSoundFile(exec, soundPath, options);
}
