import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.js';
import { config } from './config.js';

// Prisma 7 requires a driver adapter. Local dev uses SQLite; for deploy, swap to
// Postgres: `npm i @prisma/adapter-pg`, change prisma/schema.prisma provider to
// "postgresql", set DATABASE_URL, and construct PrismaPg here instead.
const adapter = new PrismaBetterSqlite3({ url: config.databaseUrl });

export const prisma = new PrismaClient({ adapter });
