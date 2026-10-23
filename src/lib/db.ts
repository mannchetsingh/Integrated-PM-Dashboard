import mongoose from "mongoose";

/**
 * Serverless functions get torn down and re-created constantly, so a fresh
 * connection per invocation would exhaust the Atlas connection pool. Cache the
 * connection promise on the global object so warm lambdas reuse it.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  _mongoose?: MongooseCache;
};

const cached: MongooseCache = globalWithMongoose._mongoose ?? {
  conn: null,
  promise: null,
};
globalWithMongoose._mongoose = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;

  // Read the URI here rather than at module scope, and throw here rather than
  // on import. Next imports every route module while collecting page data at
  // build time, so a module-scope throw fails the build on any machine without
  // runtime secrets — including CI and Vercel's builder. A request that
  // actually needs the database is the right place to complain.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Locally: copy .env.example to .env.local and fill it in. " +
        "On Vercel: add it under Settings → Environment Variables, then redeploy.",
    );
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
