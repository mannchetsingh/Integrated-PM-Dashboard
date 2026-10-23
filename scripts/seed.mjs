/**
 * Creates the indexes the models declare, and optionally a sample project so
 * there is something to look at on first run.
 *
 *   npm run db:seed
 *   npm run db:seed -- --indexes-only
 *
 * The hub has no accounts, so everything is owned by the single constant id in
 * src/lib/api.ts.
 */
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

// A URI already in the environment wins over .env.local, so this can be pointed
// at the local database started by `npm run dev:local`.
const preset = process.env.MONGODB_URI;
try {
  process.loadEnvFile(".env.local");
} catch {
  console.error("! No .env.local found. Copy .env.example to .env.local first.");
  process.exit(1);
}
if (preset) process.env.MONGODB_URI = preset;

const arg = (name) =>
  process.argv.find((entry) => entry.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const flag = (name) => process.argv.includes(`--${name}`);

const indexesOnly = flag("indexes-only");

/** Must match HUB_OWNER_ID in src/lib/api.ts. */
const OWNER_ID = "hub";

const uri = process.env.MONGODB_URI;
if (!uri || /<db_username>|<db_password>/.test(uri)) {
  console.error("✗ MONGODB_URI is missing or still has placeholders. Run: npm run db:check");
  process.exit(1);
}

/** Mirrors the index declarations in src/models/*.ts. */
const INDEXES = {
  projects: [{ ownerId: 1 }, { ownerId: 1, updatedAt: -1 }],
  tasks: [
    { ownerId: 1 },
    { projectId: 1 },
    { status: 1 },
    { ownerId: 1, status: 1, dueDate: 1 },
  ],
  meetings: [{ ownerId: 1 }, { projectId: 1 }, { ownerId: 1, date: -1 }],
  docs: [{ ownerId: 1 }, { projectId: 1 }, { ownerId: 1, updatedAt: -1 }],
  threads: [{ ownerId: 1 }, { projectId: 1 }, { ownerId: 1, updatedAt: -1 }],
};

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 15000,
});

const day = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  date.setHours(12, 0, 0, 0);
  return date;
};

try {
  await client.connect();
  const db = client.db("project_hub");
  await db.command({ ping: 1 });
  console.log(`→ Connected to ${db.databaseName}\n`);

  /* ---------- indexes ---------- */
  for (const [collection, specs] of Object.entries(INDEXES)) {
    for (const spec of specs) {
      await db.collection(collection).createIndex(spec);
    }
    console.log(`  indexes ✓  ${collection}`);
  }

  if (indexesOnly) {
    console.log("\n✓ Indexes created.");
    process.exit(0);
  }

  /* ---------- owner ---------- */
  const ownerId = OWNER_ID;

  const existing = await db
    .collection("projects")
    .findOne({ ownerId, name: "Website Redesign (sample)" });

  if (existing) {
    console.log("\n✓ Sample project already present — nothing to add.");
    process.exit(0);
  }

  /* ---------- sample data ---------- */
  const now = new Date();
  const projectId = new ObjectId();
  const meetingId = new ObjectId();

  await db.collection("projects").insertOne({
    _id: projectId,
    ownerId,
    name: "Website Redesign (sample)",
    description: "Rebuild the marketing site on the new design system.",
    status: "active",
    color: "#6366f1",
    tags: ["sample", "frontend"],
    context: [
      "Sample project, safe to delete.",
      "",
      "Goal: ship the redesigned marketing site by the end of the quarter.",
      "Stakeholders: Priya (design), Sam (engineering), Alex (content).",
      "Constraint: the pricing page copy is blocked on legal review.",
      "'DS' in these notes means the internal design system.",
    ].join("\n"),
    startDate: day(-30),
    targetDate: day(45),
    createdAt: now,
    updatedAt: now,
  });

  const tasks = [
    { title: "Audit existing pages", status: "done", priority: "medium", assignee: "Alex", due: -12 },
    { title: "Rebuild the nav on DS components", status: "in-progress", priority: "high", assignee: "Sam", due: 3 },
    { title: "Pricing page copy", status: "blocked", priority: "urgent", assignee: "Alex", due: -2 },
    { title: "Mobile breakpoints pass", status: "todo", priority: "medium", assignee: "Priya", due: 10 },
    { title: "Set up analytics events", status: "todo", priority: "low", assignee: "Sam", due: null },
  ];

  await db.collection("tasks").insertMany(
    tasks.map((task, index) => ({
      _id: new ObjectId(),
      ownerId,
      projectId,
      title: task.title,
      description:
        task.status === "blocked" ? "Waiting on legal review of the new tiers." : "",
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      dueDate: task.due === null ? null : day(task.due),
      order: index,
      sourceMeetingId: null,
      completedAt: task.status === "done" ? day(-12) : null,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await db.collection("meetings").insertOne({
    _id: meetingId,
    ownerId,
    projectId,
    title: "Weekly sync (sample)",
    date: day(-3),
    attendees: ["Priya", "Sam", "Alex"],
    rawNotes: [
      "- nav rebuild going ok, sam ~3 days out",
      "- pricing copy still stuck w/ legal",
      "- priya raised mobile breakpoints, not started",
      "- agreed: launch slips 2 wks, client informed",
    ].join("\n"),
    summary:
      "The nav rebuild is on track for later this week. Pricing copy remains blocked on legal, " +
      "which is now the critical path. The team agreed to move launch back two weeks and the " +
      "client has been told.",
    minutes: [
      "## Discussion",
      "",
      "Sam reported the navigation rebuild on design-system components is progressing and is " +
        "roughly three days from done.",
      "",
      "The pricing page copy is still with legal. No revised date was given.",
      "",
      "Priya raised that the mobile breakpoints pass has not started.",
      "",
      "## Decisions",
      "",
      "Launch moves back two weeks. The client has been informed.",
      "",
      "## Next steps",
      "",
      "Alex to chase legal on the pricing copy.",
    ].join("\n"),
    decisions: ["Launch moves back two weeks; the client has been informed."],
    actionItems: [
      { text: "Chase legal on the pricing page copy", owner: "Alex", due: "this week", taskId: null },
      { text: "Finish the nav rebuild", owner: "Sam", due: "~3 days", taskId: null },
    ],
    tags: ["sample", "weekly"],
    createdAt: now,
    updatedAt: now,
  });

  await db.collection("docs").insertOne({
    _id: new ObjectId(),
    ownerId,
    projectId,
    title: "Launch readiness checklist (sample)",
    kind: "note",
    content: [
      "# Launch readiness",
      "",
      "Sample document, safe to delete.",
      "",
      "- [x] Page audit complete",
      "- [ ] Nav rebuilt on DS",
      "- [ ] Pricing copy signed off by legal",
      "- [ ] Mobile breakpoints verified",
      "- [ ] Analytics events firing",
    ].join("\n"),
    tags: ["sample"],
    pinned: false,
    createdAt: now,
    updatedAt: now,
  });

  console.log(
    `\n✓ Seeded: 1 project, ${tasks.length} tasks, 1 meeting, 1 document.` +
      `\n  Open the hub to see it.`,
  );
} catch (error) {
  console.error(`\n✗ ${error?.message ?? error}`);
  console.error("\nRun 'npm run db:check' for a fuller diagnosis.");
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
