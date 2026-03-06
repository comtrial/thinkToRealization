// Single entry point — external code should only import from this file
export { prisma, walCheckpoint } from "./client";
export { getDBProvider, isSQLite, isPostgres } from "./config";
export type { DBProvider } from "./config";
