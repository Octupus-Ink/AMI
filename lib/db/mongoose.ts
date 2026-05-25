import mongoose from "mongoose";

type CachedConnection = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var mongooseConnection: CachedConnection | undefined;
}

const cached = globalThis.mongooseConnection ?? {
  conn: null,
  promise: null
};

globalThis.mongooseConnection = cached;

export async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    return {
      available: false,
      reason: "MONGODB_URI is not configured"
    };
  }

  if (cached.conn) {
    return {
      available: true,
      connection: cached.conn
    };
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 3000
    });
  }

  try {
    cached.conn = await cached.promise;
    return {
      available: true,
      connection: cached.conn
    };
  } catch (error) {
    cached.promise = null;
    return {
      available: false,
      reason: error instanceof Error ? error.message : "MongoDB connection failed"
    };
  }
}

export async function getDatabaseStatus() {
  const configured = Boolean(process.env.MONGODB_URI);
  const result = await connectToDatabase();

  return {
    configured,
    available: result.available,
    message: result.available ? "connected" : result.reason
  };
}
