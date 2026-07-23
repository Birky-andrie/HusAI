import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { config } from './config.js';

// Prisma 7 requires a driver adapter. We use PostgreSQL (Supabase) via
// node-postgres for both local dev and production. DATABASE_URL should be the
// Supabase "Session pooler" connection string (IPv4, port 5432) — it behaves
// like a normal Postgres connection, so migrations and prepared statements work
// without pgbouncer caveats. Switch to the transaction pooler (6543) + a
// separate DIRECT_URL only if the backend ever moves to a serverless runtime.
const adapter = new PrismaPg({ connectionString: config.databaseUrl });

export const prisma = new PrismaClient({ adapter });
