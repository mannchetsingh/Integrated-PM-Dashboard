# Project Hub

A central dashboard for your projects — tasks, meeting minutes, documents — with an
LLM assistant wired into all of it. Ask it for a status, hand it rough pointers and
get finished minutes back, or have it draft a document using what it knows about the
project.

Built on Next.js 16 (App Router) + MongoDB Atlas + NextAuth, designed to deploy to
Vercel as-is.

---

## What's in it

| Area | What you can do |
|---|---|
| **Dashboard** | Open/overdue counts, what's blocked, recent projects, meetings and writing. |
| **Projects** | Each project holds its tasks, meetings, docs, and a **Background** field — durable context the assistant sees on every question about that project. |
| **Tasks** | Kanban board (To do / In progress / Blocked / Done) with drag-and-drop, priorities, assignees and due dates. Filter by project, scope and search. |
| **Meetings** | Type rough pointers → **Write minutes** → the model returns a summary, full Markdown minutes, decisions and action items. Edit anything, then **push action items onto the task board** as real tasks. |
| **Writing** | Markdown editor with live preview and an assistant toolbar: Draft, Continue, Improve, Shorten, Expand, Summarise. Streams into the document; autosaves. |
| **Assistant** | Chat that reads your actual data. Scope it to one project or let it see everything. Conversations are saved as threads. |

The assistant's grounding is built in [`src/lib/context.ts`](src/lib/context.ts) — it
assembles a snapshot of projects, tasks, meetings and docs and injects it into the
system prompt. That's what makes "I'm new here, bring me up to speed" work.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

#### `MONGODB_URI` — **required**

> **⚠️ Replace the `<db_username>` / `<db_password>` placeholders.** Leave them in
> and the app still builds, but every database call fails with
> `bad auth : Authentication failed`.

In Atlas: **Database Access → Add New Database User**, then substitute that user's
name and password into the URI. Keep `/project_hub` before the query string — that's
the database name the app and the auth adapter use.

```
MONGODB_URI="mongodb+srv://REAL_USER:REAL_PASSWORD@<your-cluster>.mongodb.net/project_hub?retryWrites=true&w=majority&appName=Cluster0"
```

If the password contains `@ : / ? # [ ] %`, URL-encode it (`p@ss` → `p%40ss`).

Also set **Network Access → Allow access from anywhere (`0.0.0.0/0`)** — Vercel's
functions don't have fixed egress IPs.

Then confirm it works — this reports exactly what's wrong if it doesn't:

```bash
npm run db:check
```

Once it passes, create the indexes and (optionally) a sample project:

```bash
npm run db:seed -- --email=you@example.com   # indexes + sample data
npm run db:seed -- --indexes-only            # indexes only
```

#### `AUTH_SECRET` — **required**

Generate one:

```bash
npx auth secret
```

#### `AUTH_PASSWORD` — **required in production**

Sign-in is email + password. There's no OAuth and no user table: your email is
hashed into a stable owner id, and `AUTH_PASSWORD` is the single shared password
that guards the door.

```
AUTH_PASSWORD="something-long-and-unguessable"
```

Leave it empty **locally** and the password field disappears — any email signs
straight in, which is convenient on your own machine.

**In production it is mandatory and fails closed:** with `NODE_ENV=production`
and no `AUTH_PASSWORD`, every sign-in is refused and the login page says so. That
is deliberate — a passwordless hub on a public URL would let anyone who guesses
your email read your meeting minutes.

Different emails get entirely separate hubs; they share only the password. To
restrict which addresses may sign in at all, add `ALLOWED_EMAILS`.

#### `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — at least one

Everything except the AI features works without a key; the model picker only offers
providers that have one configured. `DEFAULT_LLM_PROVIDER` picks the default
(`anthropic` or `openai`).

#### `ALLOWED_EMAILS` — optional

Comma-separated allowlist applied on top of the password. Accepts full addresses
(`me@gmail.com`) or domains (`@company.com`). Empty means any email that knows
the password gets in — **set it if the app is on a public URL.**

### 3. Run

```bash
npm run dev
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:check` | Verifies `MONGODB_URI` and explains any failure |
| `npm run db:seed -- --email=…` | Creates indexes, adds a sample project |
| `npm run db:seed -- --indexes-only` | Indexes only, no sample data |

---

## Deploying to Vercel

1. Push the repo to GitHub.
2. **Vercel → Add New → Project**, import it. The defaults are correct; no build
   configuration needed.
3. Add these under **Settings → Environment Variables** (Production, Preview and
   Development):

   | Variable | Notes |
   |---|---|
   | `MONGODB_URI` | Atlas, with real credentials. The local dev database does not exist here. |
   | `AUTH_SECRET` | `npx auth secret` |
   | `AUTH_PASSWORD` | **Mandatory** — without it the deployment blocks all sign-in |
   | `ANTHROPIC_API_KEY` | Or `OPENAI_API_KEY`, for the AI features |
   | `ALLOWED_EMAILS` | Recommended on a public URL |

4. Deploy.

`AUTH_URL` is auto-detected; only set it if sign-in redirects somewhere wrong.

The three LLM routes declare `maxDuration = 60`. That's within what Vercel allows on
Hobby with Fluid Compute; if a long generation gets cut off, raise it (Pro) or pick a
faster model.

---

## Layout

```
src/
├── app/
│   ├── (app)/              # Signed-in area — layout.tsx is the auth guard
│   │   ├── page.tsx        # Dashboard
│   │   ├── projects/       # List + per-project workspace (tabbed)
│   │   ├── tasks/          # Global kanban
│   │   ├── meetings/       # List, new, and the MOM editor
│   │   ├── docs/           # List, new, and the writing editor
│   │   └── chat/           # Hub assistant + thread history
│   ├── api/                # Route handlers (ownership enforced per query)
│   └── login/
├── components/             # Sidebar, TaskBoard, ChatPanel, editors, UI primitives
├── lib/
│   ├── context.ts          # Builds the project snapshot fed to the model
│   ├── llm/                # Anthropic + OpenAI behind one interface
│   ├── auth.ts, db.ts      # NextAuth config, cached mongoose connection
│   └── client.ts, hooks.ts # Browser-side fetch + streaming helpers
└── models/                 # Mongoose schemas
```

### Notes on the design

- **Ownership is enforced in the query**, never from the request body — every handler
  starts with `currentUserId()` and filters on `ownerId`.
- **Auth is guarded in a layout, not middleware**, in `src/app/(app)/layout.tsx`.
- **No user table.** Sign-in is email + password with JWT sessions, so an owner id is
  just `sha256(email)` truncated. Nothing about an account needs persisting, which is
  why there's no auth database adapter.
- **Connections are cached on `globalThis`** so warm lambdas reuse them instead of
  exhausting the Atlas pool.
- **Adding a model** is a one-line edit to `src/lib/llm/models.ts`.
