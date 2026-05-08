import { defineConfig, env } from "@prisma/config";

// Prisma's CLI auto-loads .env, but this project keeps secrets in .env.local
// (gitignored, Next.js convention). Load it before defineConfig() reads env.
try {
  process.loadEnvFile(".env.local");
} catch {
  // File may not exist in CI/prod where vars come from the environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
