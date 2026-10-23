import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckSquare, FileText, Mic, Sparkles } from "lucide-react";
import { auth, passwordRequired, signIn, signInDisabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

const HIGHLIGHTS = [
  { icon: CheckSquare, text: "Track every project and task in one board" },
  { icon: Mic, text: "Turn rough pointers into finished meeting minutes" },
  { icon: FileText, text: "Draft and refine documents with an assistant that knows your work" },
];

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
            Your email decides whose hub you open.
          </p>

          {signInDisabled ? (
            <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-200">
              <p className="font-medium">Sign-in is disabled</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
                No <code className="font-mono">AUTH_PASSWORD</code> is set, so this deployment
                refuses to let anyone in. Set it in the environment and redeploy.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <p className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {error === "CredentialsSignin"
                    ? "That email or password wasn't accepted."
                    : "Sign-in failed. Please try again."}
                </p>
              )}

              <form
                className="mt-6 space-y-3"
                action={async (formData: FormData) => {
                  "use server";
                  await signIn("credentials", {
                    email: String(formData.get("email") ?? ""),
                    password: String(formData.get("password") ?? ""),
                    redirectTo: "/",
                  });
                }}
              >
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium tracking-wide text-ink-dim uppercase">
                    Email
                  </span>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="you@example.com"
                    className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                  />
                </label>

                {passwordRequired && (
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium tracking-wide text-ink-dim uppercase">
                      Password
                    </span>
                    <input
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                    />
                  </label>
                )}

                <button
                  type="submit"
                  className="h-10 w-full rounded-lg border border-accent-dim/60 bg-accent text-sm font-medium text-white shadow-sm shadow-accent/20 transition-colors hover:bg-accent-dim"
                >
                  Sign in
                </button>
              </form>

              {!passwordRequired && (
                <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-200/80">
                  No password is set, so any email can sign in. Fine on your own machine — set{" "}
                  <code className="font-mono">AUTH_PASSWORD</code> before putting this on a
                  public URL.
                </p>
              )}
            </>
          )}

          <p className="mt-6 text-xs leading-relaxed text-ink-faint">
            This hub stores your projects, notes and chat history in the database you
            configured.
          </p>
        </div>
      </div>
    </div>
  );
}
