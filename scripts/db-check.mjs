/**
 * Verifies MONGODB_URI actually works, and explains it when it doesn't.
 *
 *   npm run db:check
 */
import { MongoClient, ServerApiVersion } from "mongodb";

// Load .env.local the same way `next dev` does, but let a URI already in the
// environment win — that's how `npm run dev:local` targets the local database.
const preset = process.env.MONGODB_URI;
try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("! No .env.local found. Copy .env.example to .env.local first.\n");
}
if (preset) process.env.MONGODB_URI = preset;

const uri = process.env.MONGODB_URI;

const fail = (message, hint) => {
  console.error(`\n✗ ${message}`);
  if (hint) console.error(`\n${hint}`);
  process.exit(1);
};

if (!uri) {
  fail("MONGODB_URI is not set in .env.local.");
}

if (/<db_username>|<db_password>|<username>|<password>/.test(uri)) {
  fail(
    "MONGODB_URI still contains the placeholder <db_username> / <db_password>.",
    [
      "Replace them with a real Atlas database user:",
      "",
      "  1. Atlas → Database Access → Add New Database User",
      "  2. Give it a username and password, role 'Read and write to any database'",
      "  3. Put those into MONGODB_URI in .env.local",
      "",
      "If the password contains @ : / ? # [ ] %, URL-encode it (p@ss → p%40ss).",
    ].join("\n"),
  );
}

// Surface the database name early — a URI without one silently uses "test".
const dbName = (() => {
  const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
  return match?.[1] || null;
})();

if (!dbName) {
  console.error(
    "! The URI has no database name before the '?'. Add /project_hub so the app\n" +
      "  and the auth adapter agree on where data lives.\n",
  );
}

console.log(`→ Connecting to ${uri.replace(/\/\/[^@]+@/, "//***:***@")}`);

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 15000,
});

try {
  await client.connect();
  const db = client.db(dbName ?? "project_hub");
  await db.command({ ping: 1 });

  console.log(`✓ Connected. Database: ${db.databaseName}\n`);

  const collections = await db.listCollections().toArray();
  if (collections.length === 0) {
    console.log("  (no collections yet — they appear once you create something)");
  } else {
    for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await db.collection(name).estimatedDocumentCount();
      console.log(`  ${name.padEnd(24)} ${count}`);
    }
  }

  console.log("\n✓ The database is ready.");
} catch (error) {
  const message = String(error?.message ?? error);

  if (/bad auth|Authentication failed/i.test(message)) {
    fail(
      "Authentication failed — the username or password is wrong.",
      [
        "Check in Atlas → Database Access that this user exists and the password matches.",
        "Resetting the password there is the quickest fix.",
        "Remember to URL-encode special characters in the password.",
      ].join("\n"),
    );
  }

  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(message)) {
    fail(
      "Could not resolve the cluster hostname.",
      "Check the cluster address in the URI, and that you're online.",
    );
  }

  if (/timed out|ETIMEDOUT|ServerSelection/i.test(message)) {
    fail(
      "Connected to DNS but no server would accept the connection.",
      [
        "This is almost always the IP allowlist:",
        "  Atlas → Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0)",
        "",
        "Vercel's functions have no fixed egress IP, so 0.0.0.0/0 is required for deploys.",
      ].join("\n"),
    );
  }

  fail(message);
} finally {
  await client.close().catch(() => {});
}
