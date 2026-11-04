import './load-env';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Idempotent seed: ensures an initial ADMIN account exists.
 *
 * - Reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD; skips (exit 0) when either is unset,
 *   so it is safe to run on every container start.
 * - Never touches an existing user (no password overwrite, no role promotion).
 *
 * Dev:  pnpm db:seed                 (runs this file via tsx)
 * Prod: node dist/prisma/seed.js     (compiled by `pnpm build`)
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('[seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set, skipping admin seed');
    return;
  }
  if (password.length < 8) {
    throw new Error('[seed] SEED_ADMIN_PASSWORD must be at least 8 characters');
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('[seed] DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role === 'ADMIN') {
        console.log(`[seed] admin ${email} already exists, nothing to do`);
      } else {
        // Deliberately NOT auto-promoting: anyone could have self-registered this email
        // first and would otherwise inherit ADMIN with a password they control.
        console.warn(
          `[seed] WARNING: ${email} exists as a non-admin user; refusing to promote it. ` +
            'Verify the account owner and promote manually if intended.',
        );
      }
      return;
    }

    const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10);
    await prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, saltRounds),
        name: 'Administrator',
        role: 'ADMIN',
      },
    });
    console.log(`[seed] created admin ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
