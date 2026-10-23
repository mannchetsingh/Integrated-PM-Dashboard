import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Where `ant auth login` writes its OAuth profiles. The SDK reads these on its
 * own, so an unset ANTHROPIC_API_KEY does not mean there are no credentials.
 */
function profileDir() {
  if (process.env.ANTHROPIC_CONFIG_DIR) return process.env.ANTHROPIC_CONFIG_DIR;
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "Anthropic");
  }
  return path.join(os.homedir(), ".config", "anthropic");
}

/**
 * True when the Anthropic SDK will be able to authenticate: an explicit key, a
 * bearer token, or a logged-in OAuth profile on disk.
 *
 * Only the first two exist on Vercel — a profile is a local-development thing,
 * so a deployment still needs ANTHROPIC_API_KEY set in its environment.
 */
export function hasAnthropicCredentials(): boolean {
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return true;

  try {
    return existsSync(path.join(profileDir(), "credentials"));
  } catch {
    return false;
  }
}
