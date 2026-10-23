import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckSquare, FileText, Mic, Sparkles } from "lucide-react";
import { auth, devLoginEnabled, signIn } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

const HIGHLIGHTS = [
  { icon: CheckSquare, text: "Track every project and task in one board" },
  { icon: Mic, text: "Turn rough pointers into finished meeting minutes" },
  { icon: FileText, text: "Draft and refine documents with an assistant that knows your work" },
];

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.26a12 12 0 0 0 0 10.76l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.18 15.23 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.11C6.22 6.87 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/40 md:grid md:grid-cols-2">
        {/* Pitch */}
        <div className="hidden flex-col justify-between border-r border-line bg-gradient-to-br from-accent/12 via-surface to-surface p-9 md:flex">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 ring-1 ring-accent/30">
              <Sparkles size={18} className="text-accent-soft" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Project Hub</span>
          </div>

          <div className="space-y-5 py-10">
            <h2 className="text-2xl leading-snug font-semibold tracking-tight text-balance">
              Everything about your projects, in one place.
            </h2>
            <ul className="space-y-3.5">
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-sm text-ink-dim">
                  <Icon size={17} className="mt-0.5 shrink-0 text-accent-soft" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-ink-faint">
            Your data stays in your own MongoDB Atlas cluster.
          </p>
        </div>

        {/* Sign-in */}
        <div className="flex flex-col justify-center p-9">
          <div className="mb-8 flex items-center gap-2.5 md:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 ring-1 ring-accent/30">
              <Sparkles size={18} className="text-accent-soft" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Project Hub</span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1.5 text-sm text-ink-faint">
            Use your Google account to open your hub.
          </p>

          {error && (
            <p className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error === "AccessDenied"
                ? "That account isn't on the allowlist for this hub."
                : "Sign-in failed. Please try again."}
            </p>
          )}

          <form
            className="mt-6"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface-2 text-sm font-medium transition-colors hover:bg-surface-3"
            >
              <GoogleMark />
              Continue with Google
            </button>
          </form>

          {devLoginEnabled && (
            <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5">
              <p className="text-xs font-medium text-amber-200">Local development sign-in</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-faint">
                No password — for use before Google OAuth is set up. Disabled automatically in
                production.
              </p>

              <form
                className="mt-3 flex gap-2"
                action={async (formData: FormData) => {
                  "use server";
                  await signIn("dev", {
                    email: String(formData.get("email") ?? ""),
                    redirectTo: "/",
                  });
                }}
              >
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="h-9 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-9 shrink-0 rounded-lg border border-line bg-surface-3 px-3 text-sm font-medium transition-colors hover:bg-surface-2"
                >
                  Sign in
                </button>
              </form>
            </div>
          )}

          <p className="mt-6 text-xs leading-relaxed text-ink-faint">
            By signing in you agree that this hub stores your projects, notes and chat history in
            the database you configured.
          </p>
        </div>
      </div>
    </div>
  );
}
