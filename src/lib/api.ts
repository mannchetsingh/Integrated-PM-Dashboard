import { NextResponse } from "next/server";

/**
 * This hub has no authentication — every visitor is the same person.
 *
 * Records still carry an ownerId so the queries, indexes and models didn't have
 * to change, and so sign-in can be reintroduced later without a data migration.
 * It's just a constant now rather than a signed-in user's id.
 */
export const HUB_OWNER_ID = "hub";

export async function currentUserId(): Promise<string | null> {
  return HUB_OWNER_ID;
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
