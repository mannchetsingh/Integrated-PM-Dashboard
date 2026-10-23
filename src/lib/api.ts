import { NextResponse } from "next/server";
import { auth } from "./auth";

/**
 * Returns the signed-in user's id, or null. Every route handler should start
 * with this — ownership is enforced by filtering on ownerId in the query, not
 * by trusting an id from the request body.
 */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export const unauthorized = () =>
  NextResponse.json({ error: "Not signed in" }, { status: 401 });

export const notFound = (what = "Not found") =>
  NextResponse.json({ error: what }, { status: 404 });

export const badRequest = (message: string) =>
  NextResponse.json({ error: message }, { status: 400 });

export function serverError(error: unknown) {
  console.error(error);
  const message = error instanceof Error ? error.message : "Something went wrong";
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Strips mongoose/BSON types so the result is safe to hand to a client component. */
export function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
