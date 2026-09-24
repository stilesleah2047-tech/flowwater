import mongoose from "mongoose";

/**
 * Vercel serverless functions can be invoked many times against the same
 * warm container, and Next.js hot-reloads modules in dev — without
 * caching, each invocation would open a brand new MongoDB connection and
 * quickly exhaust Atlas's connection limit. This caches the connection
 * (and the in-flight connect promise, to avoid a race when multiple
 * requests hit a cold container simultaneously) on the Node.js global
 * object, which survives across invocations within the same warm
 * container/module scope.
 */
declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

const cache = global.__mongooseCache ?? { conn: null, promise: null };
global.__mongooseCache = cache;

export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not set");
    }
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(uri, {
      maxPoolSize: 5,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
