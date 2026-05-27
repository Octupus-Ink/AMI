import mongoose from "mongoose";

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as typeof globalThis & {
  mongooseConnection?: CachedConnection;
};

const cached = globalForMongoose.mongooseConnection ?? {
  conn: null,
  promise: null
};

globalForMongoose.mongooseConnection = cached;

export function hasMongoUri() {
  return Boolean(process.env.MONGODB_URI?.trim());
}

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    return null;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
