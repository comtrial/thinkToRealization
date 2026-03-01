-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "summary" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "stages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage_id" TEXT NOT NULL,
    "title" TEXT,
    "auto_summary" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "sessions_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "terminal_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "raw_length" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "terminal_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage_id" TEXT NOT NULL,
    "session_id" TEXT,
    "content" TEXT NOT NULL,
    "context" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "decisions_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "decisions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "stage_id" TEXT,
    "activity_type" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activities_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "projects_status_updated_at_idx" ON "projects"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "stages_project_id_order_index_idx" ON "stages"("project_id", "order_index");

-- CreateIndex
CREATE INDEX "stages_project_id_status_idx" ON "stages"("project_id", "status");

-- CreateIndex
CREATE INDEX "sessions_stage_id_updated_at_idx" ON "sessions"("stage_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "terminal_logs_session_id_created_at_idx" ON "terminal_logs"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "decisions_stage_id_created_at_idx" ON "decisions"("stage_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "activities_project_id_created_at_idx" ON "activities"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "activities_stage_id_idx" ON "activities"("stage_id");
