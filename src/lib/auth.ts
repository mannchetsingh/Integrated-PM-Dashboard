import { createHash } from "node:crypto";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongoClient";

/**
 * An email-only sign-in for local work, so the hub is usable before a Google
 * OAuth client exists. Both conditions are required, and NODE_ENV is "production"
 * on Vercel, so this cannot switch itself on in a deployment.
 */
export const devLoginEnabled =
  process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_LOGIN === "true";

/** Same email always maps to the same ownerId, so seeded data keeps its owner. */
export const devUserId = (email: string) =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24);

const devProvider = Credentials({
  id: "dev",
  name: "Development login",
  credentials: { email: { label: "Email", type: "email" } },
  authorize(credentials) {
    const email = String(credentials?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email || !email.includes("@")) return null;
    return { id: devUserId(email), email, name: email.split("@")[0] };
  },
});

/**
 * Optional allowlist. Entries can be full emails ("me@gmail.com") or domains
 * ("@company.com"). An empty ALLOWED_EMAILS lets any Google account in.
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
  adapter: MongoDBAdapter(clientPromise, { databaseName: "project_hub" }),
  providers: devLoginEnabled ? [Google, devProvider] : [Google],
  // JWT sessions keep the hot path off the database on every request. The
  // adapter is still here so accounts/users persist in Atlas.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ user }) {
      return isAllowed(user.email);
    },
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
