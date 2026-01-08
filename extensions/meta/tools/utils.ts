import * as fs from "node:fs";
import * as path from "node:path";

// Helper function to find the currently running Pi installation directory
export function findPiInstallation(): string | null {
  try {
    // Try to resolve the main Pi module to find where it's actually loaded from
    const piModulePath = require.resolve(
      "@mariozechner/pi-coding-agent/package.json",
    );
    return path.dirname(piModulePath);
  } catch (error) {
    // Fallback: check process.argv to find the running script path
    const scriptPath = process.argv[1];
    if (scriptPath) {
      // Walk up from script path to find Pi installation
      let currentDir = path.dirname(scriptPath);

      while (currentDir !== path.dirname(currentDir)) {
        const packageJsonPath = path.join(currentDir, "package.json");
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageContent = fs.readFileSync(packageJsonPath, "utf-8");
            const packageJson = JSON.parse(packageContent);
            if (packageJson.name === "@mariozechner/pi-coding-agent") {
              return currentDir;
            }
          } catch {
            // Continue searching
          }
        }
        currentDir = path.dirname(currentDir);
      }
    }

    return null;
  }
}
