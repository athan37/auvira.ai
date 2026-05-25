import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoose__: MongooseCache | undefined;
}

let cached: MongooseCache = global.__mongoose__ ?? { conn: null, promise: null };
global.__mongoose__ = cached;

export async function connectMongoDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    const opts = { bufferCommands: false };
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch {
    cached.promise = null;
    throw new Error('Failed to connect to MongoDB');
  }

  return cached.conn;
}

export { mongoose };