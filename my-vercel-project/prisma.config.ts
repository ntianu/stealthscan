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
    url: env("DATABASE_URL"),
  },
});
