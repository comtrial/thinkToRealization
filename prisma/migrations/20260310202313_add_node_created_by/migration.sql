-- AlterTable: Add createdById to Node
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'task',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'backlog',
    "priority" TEXT NOT NULL DEFAULT 'none',
    "canvasX" REAL NOT NULL DEFAULT 0,
    "canvasY" REAL NOT NULL DEFAULT 0,
    "canvasW" REAL NOT NULL DEFAULT 280,
    "canvasH" REAL NOT NULL DEFAULT 140,
    "parentNodeId" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Node_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Node_parentNodeId_fkey" FOREIGN KEY ("parentNodeId") REFERENCES "Node" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Node_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Node_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Node" ("assigneeId", "canvasH", "canvasW", "canvasX", "canvasY", "createdAt", "description", "dueDate", "id", "parentNodeId", "priority", "projectId", "status", "title", "type", "updatedAt") SELECT "assigneeId", "canvasH", "canvasW", "canvasX", "canvasY", "createdAt", "description", "dueDate", "id", "parentNodeId", "priority", "projectId", "status", "title", "type", "updatedAt" FROM "Node";
DROP TABLE "Node";
ALTER TABLE "new_Node" RENAME TO "Node";
CREATE INDEX "Node_projectId_status_idx" ON "Node"("projectId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
