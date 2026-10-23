/**
 * Runs the hub against a local MongoDB, with no Atlas account needed.
 *
 *   npm run dev:local
 *
 * Starts a real mongod on a free port, stores its data in .local-db/ so it
 * survives restarts, then launches `next dev` pointed at it. The first run
 * downloads a mongod binary (~100MB) and caches it.
 *
 * MONGODB_URI is passed through the environment, which takes precedence over
 * .env.local, so the Atlas URI there is left untouched.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

const dbPath = path.resolve(".local-db");
mkdirSync(dbPath, { recursive: true });

console.log("→ Starting local MongoDB…");
console.log("  (first run downloads a mongod binary — this can take a minute)\n");

let server;
try {
  server = await MongoMemoryServer.create({
    instance: { dbName: "project_hub", dbPath, storageEngine: "wiredTiger" },
  });
} catch (error) {
  console.error(`\n✗ Could not start a local MongoDB: ${error?.message ?? error}`);
  console.error("\nFall back to Atlas: fill MONGODB_URI in .env.local, then `npm run dev`.");
  process.exit(1);
}

const uri = server.getUri("project_hub");
console.log(`✓ Local MongoDB ready at ${uri}`);
console.log(`  Data persists in ${dbPath}\n`);

const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, MONGODB_URI: uri },
});

let shuttingDown = false;
const shutdown = async (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  await server.stop().catch(() => {});
  process.exit(code);
};

child.on("exit", (code) => void shutdown(code ?? 0));
process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));
