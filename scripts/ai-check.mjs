/**
 * Verifies the Anthropic credentials actually work, and says plainly what's
 * wrong when they don't — including the case people hit most: a valid key on an
 * org with no API credit.
 *
 *   npm run ai:check
 */
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const preset = process.env.ANTHROPIC_API_KEY;
try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("! No .env.local found.\n");
}
if (preset) process.env.ANTHROPIC_API_KEY = preset;

// An unset ANTHROPIC_API_KEY doesn't mean there are no credentials — the SDK
// also reads ANTHROPIC_AUTH_TOKEN and the `ant auth login` profile on disk.
const profileDir =
  process.env.ANTHROPIC_CONFIG_DIR ??
  (process.platform === "win32" && process.env.APPDATA
    ? path.join(process.env.APPDATA, "Anthropic")
    : path.join(os.homedir(), ".config", "anthropic"));

const source = process.env.ANTHROPIC_API_KEY
  ? "ANTHROPIC_API_KEY"
  : process.env.ANTHROPIC_AUTH_TOKEN
    ? "ANTHROPIC_AUTH_TOKEN"
    : existsSync(path.join(profileDir, "credentials"))
      ? "OAuth profile (ant auth login)"
      : null;

if (!source) {
  console.error("✗ No Anthropic credentials found.\n");
  console.error("Add one of these:");
  console.error('  • ANTHROPIC_API_KEY="sk-ant-..." in .env.local');
  console.error("      from console.anthropic.com → API keys → Create key");
  console.error("  • or run `ant auth login` to sign in with your account\n");
  console.error("Either way the org needs API billing enabled — a Claude");
  console.error("subscription does not include API credit.");
  process.exit(1);
}

console.log(`→ Credential source: ${source}`);
console.log("→ Sending a 4-token test request to claude-opus-5…\n");

// Bare constructor: lets the SDK resolve key → token → profile itself.
const client = new Anthropic();

try {
  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16,
    messages: [{ role: "user", content: "Reply with the single word: ready" }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  console.log(`✓ Claude replied: "${text}"`);
  console.log(
    `  model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`,
  );
  console.log("\n✓ The AI features are ready. Restart the dev server to pick this up.");
} catch (error) {
  // Most specific first — the distinctions matter for what to tell the user.
  if (error instanceof Anthropic.AuthenticationError) {
    console.error("✗ The credential was rejected (401).");
    console.error("\n  The key is wrong, revoked, or truncated when pasted.");
    console.error("  Keys start with 'sk-ant-'. Create a fresh one at");
    console.error("  console.anthropic.com → API keys.");
  } else if (error instanceof Anthropic.PermissionDeniedError) {
    console.error("✗ Authenticated, but not permitted to use this model (403).");
    console.error("\n  The key may be workspace-scoped without model access.");
  } else if (error instanceof Anthropic.RateLimitError) {
    console.error("✗ Rate limited (429).");
    console.error("\n  The credential works — you're just over a limit. Retry shortly.");
  } else if (error instanceof Anthropic.BadRequestError) {
    console.error(`✗ Request rejected (400): ${error.message}`);
    console.error("\n  If this mentions credit or billing, the key is valid but the org");
    console.error("  has no API balance. Add one at console.anthropic.com → Billing.");
    console.error("  A Claude subscription does not fund API usage.");
  } else if (error instanceof Anthropic.APIConnectionError) {
    console.error("✗ Could not reach api.anthropic.com.");
    console.error("\n  Check your network, proxy or firewall.");
  } else if (error instanceof Anthropic.APIError) {
    console.error(`✗ API error ${error.status}: ${error.message}`);
  } else {
    console.error(`✗ ${error?.message ?? error}`);
  }
  process.exitCode = 1;
}
