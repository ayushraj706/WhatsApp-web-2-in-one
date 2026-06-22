import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["warn", "error"],
    datasourceUrl: process.env.DATABASE_URL, // <-- Prisma 7 ke liye yahan URL add kiya gaya hai
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
