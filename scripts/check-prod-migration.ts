/**
 * Production Migration Checker
 *
 * Compares schema.models.prisma against the actual Supabase (production) DB.
 * If there are missing columns/tables, outputs the ALTER statements needed.
 *
 * Usage:
 *   npm run db:check-prod        # Check for drift
 *   npm run db:migrate:prod      # Apply missing changes
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

async function main() {
  const envPath = path.resolve(__dirname, "..", ".env.production");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const envVars: Record<string, string> = {};
  for (const line of envContent.split("\n")) {
    const match = line.match(/^(\w+)="?([^"]*)"?$/);
    if (match) envVars[match[1]] = match[2];
  }

  const DIRECT_URL = envVars.DIRECT_URL;
  if (!DIRECT_URL) {
    console.error("DIRECT_URL not found in .env.production");
    process.exit(1);
  }

  // Generate postgres schema temporarily
  console.log("Generating postgres schema...");
  execSync("npm run schema:postgres", { stdio: "pipe" });

  try {
    const diff = execSync(
      `npx prisma migrate diff --from-url "${DIRECT_URL}" --to-schema-datamodel prisma/schema.prisma --script`,
      {
        env: { ...process.env, DATABASE_URL: DIRECT_URL, DIRECT_URL },
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }
    ).trim();

    if (!diff || diff === "-- This is an empty migration.") {
      console.log("✅ Production DB is in sync with schema. No changes needed.");
    } else {
      console.log("⚠️  Production DB is OUT OF SYNC. Changes needed:\n");
      console.log(diff);
      console.log("");

      const shouldApply = process.argv.includes("--apply");
      if (shouldApply) {
        console.log("Applying changes to production DB...");
        const { PrismaClient } = require("@prisma/client");
        const prisma = new PrismaClient({
          datasources: { db: { url: DIRECT_URL } },
        });

        const statements = diff
          .split(";")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0 && !s.startsWith("--"));

        for (const stmt of statements) {
          try {
            await prisma.$executeRawUnsafe(stmt + ";");
            console.log(`  ✓ ${stmt.slice(0, 100)}`);
          } catch (e) {
            console.error(`  ✗ Failed: ${stmt.slice(0, 100)}`);
            console.error(`    ${(e as Error).message}`);
          }
        }
        await prisma.$disconnect();
        console.log("\n✅ Migration applied to production.");
      } else {
        console.log("Run with --apply to apply these changes:");
        console.log("  npm run db:migrate:prod");
      }
    }
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    console.error("Error:", err.stderr || err.message);
    process.exit(1);
  } finally {
    // Restore sqlite schema
    console.log("Restoring sqlite schema...");
    execSync("npm run schema:sqlite", { stdio: "pipe" });
  }
}

main();
