import path from "path";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local first (Next.js convention), then fall back to .env
config({ path: path.resolve(process.cwd(), ".env.local") });
config({ path: path.resolve(process.cwd(), ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    // Use direct (non-pooled) connection for CLI commands (migrate, introspect, etc.)
    // so Prisma advisory locks work correctly on Neon.
    // Falls back to DATABASE_URL in local dev where DIRECT_DATABASE_URL isn't set.
    url: env("DIRECT_DATABASE_URL") ?? env("DATABASE_URL"),
  },
});
