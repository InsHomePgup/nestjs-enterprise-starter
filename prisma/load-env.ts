import { config } from 'dotenv';

// Mirror ConfigModule's lookup order in src/app.module.ts so Prisma CLI / seed
// read the same values as the app: `.env` first, then `.env.${NODE_ENV}`.
// Earlier files win; real environment variables always win over both.
config({
  path: ['.env', `.env.${process.env.NODE_ENV ?? 'development'}`],
  quiet: true,
});
