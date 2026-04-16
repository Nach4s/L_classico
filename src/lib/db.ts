// ===================================
// Prisma Client Singleton
// ===================================
// Prevents multiple PrismaClient instances during Next.js HMR in development.
// In production a single instance is created per server process.
// ===================================

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Get connection string explicitly
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be defined");
}

// 1. Instantiate the Pool with the connection URL
const pool = new Pool({ connectionString });

// 2. Instantiate the PrismaPg adapter directly using the pg Pool
const adapter = new PrismaPg(pool);

// 3. Declare global object to prevent connection leaks during HMR
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 4. Initialize Prisma client by passing adapter inside the constructor
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

// 5. Store globally in dev to prevent excessive instances
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
