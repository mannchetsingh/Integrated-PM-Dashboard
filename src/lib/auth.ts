import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Email + password sign-in — the only way in. There's no OAuth provider and no
 * database adapter: sessions are JWTs and a user is just their email, so
 * nothing about an account needs persisting.
 */

/** The shared password, from AUTH_PASSWORD. Empty means none is configured. */
const expectedPassword = process.env.AUTH_PASSWORD ?? "";

/** With a password set, every sign-in must present it. */
export const passwordRequired = expectedPassword.length > 0;

/**
 * Fail closed: an unprotected hub on a public URL would let anyone read your
 * meeting minutes, so production refuses to sign anyone in until AUTH_PASSWORD
 * is set. Locally it stays optional for convenience.
 */
export const signInDisabled = process.env.NODE_ENV === "production" && !passwordRequired;

/** Constant-time compare so the password can't be recovered by timing. */
function passwordMatches(supplied: string) {
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expectedPassword).digest();
  return timingSafeEqual(a, b);
}

/**
 * A stable owner id derived from the email, so the same address always lands on
 * the same data — across restarts, and without a users table.
 */
export const userIdForEmail = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24);

/**
 * Optional allowlist on top of the password. Entries can be full emails
 * ("me@gmail.com") or domains ("@company.com"). Empty means any email that
 * knows the password gets in — each to its own separate hub.
 */
const allowList = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

function isAllowed(email?: string | null) {
  if (allowList.length === 0) return true;
  if (!email) return false;
  const normalized = email.toLowerCase();
  return allowList.some((entry) =>
    entry.startsWith("@") ? normalized.endsWith(entry) : normalized === entry,
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize(credentials) {
        if (signInDisabled) return null;

        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        if (!email || !email.includes("@")) return null;

        if (passwordRequired && !passwordMatches(String(credentials?.password ?? ""))) {
          return null;
        }
        if (!isAllowed(email)) return null;

        return { id: userIdForEmail(email), email, name: email.split("@")[0] };
      },
    }),
  ],
  // Credentials sign-in requires JWT sessions; it also keeps every request off
  // the database, which is why no adapter is needed.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
