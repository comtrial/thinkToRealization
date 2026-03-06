import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export default async function globalSetup() {
  const projectRoot = path.resolve(__dirname, "..");
  const testDbPath = path.join(projectRoot, "prisma", "test.db");

  // Delete existing test.db for a clean state
  for (const ext of ["", "-shm", "-wal", "-journal"]) {
    const f = testDbPath + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  // Apply migrations to create a fresh test.db
  execSync("npx prisma migrate deploy", {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATABASE_URL: `file:${testDbPath}`,
    },
    stdio: "pipe",
  });

  console.log("[globalSetup] test.db initialized");
}
