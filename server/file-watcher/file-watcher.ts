import { watch, type FSWatcher as ChokidarWatcher } from "chokidar";
import path from "path";
import { prisma } from "../../src/lib/prisma";
import { eventBus } from "../events/event-bus";

interface FileChange {
  filePath: string;
  changeType: "created" | "modified" | "deleted";
  detectedAt: Date;
}

interface WatcherEntry {
  watcher: ChokidarWatcher;
  nodeId: string;
  projectDir: string;
  changeBuffer: FileChange[];
  debounceTimer: NodeJS.Timeout | null;
}

const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.devflow-logs/**",
  "**/*.db",
  "**/*.db-shm",
  "**/*.db-wal",
  "**/.DS_Store",
];

const DEBOUNCE_MS = 300;

export class FileWatcher {
  private watchers = new Map<string, WatcherEntry>();

  watch(projectDir: string, sessionId: string, nodeId: string): void {
    if (this.watchers.has(sessionId)) {
      console.log(`[file-watcher] Already watching for session ${sessionId}`);
      return;
    }

    const watcher = watch(projectDir, {
      ignored: IGNORE_PATTERNS,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200 },
      depth: 5,
    });

    const entry: WatcherEntry = {
      watcher,
      nodeId,
      projectDir,
      changeBuffer: [],
      debounceTimer: null,
    };

    const handleChange = (changeType: "created" | "modified" | "deleted", filePath: string) => {
      const relativePath = path.relative(projectDir, filePath);
      entry.changeBuffer.push({
        filePath: relativePath,
        changeType,
        detectedAt: new Date(),
      });

      // Reset debounce timer
      if (entry.debounceTimer) {
        clearTimeout(entry.debounceTimer);
      }
      entry.debounceTimer = setTimeout(() => {
        this.flushChanges(sessionId);
      }, DEBOUNCE_MS);
    };

    watcher
      .on("add", (fp) => handleChange("created", fp))
      .on("change", (fp) => handleChange("modified", fp))
      .on("unlink", (fp) => handleChange("deleted", fp))
      .on("error", (err) => {
        console.error(`[file-watcher] Error for session ${sessionId}:`, err);
      });

    this.watchers.set(sessionId, entry);
    console.log(`[file-watcher] Watching ${projectDir} for session ${sessionId}`);
  }

  async unwatch(sessionId: string): Promise<void> {
    const entry = this.watchers.get(sessionId);
    if (!entry) return;

    // Flush any remaining changes before closing
    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }
    await this.flushChanges(sessionId);

    entry.watcher.close().catch((err) => {
      console.error(`[file-watcher] Error closing watcher for session ${sessionId}:`, err);
    });

    this.watchers.delete(sessionId);
    console.log(`[file-watcher] Stopped watching for session ${sessionId}`);
  }

  dispose(): void {
    for (const [sessionId] of Array.from(this.watchers)) {
      this.unwatch(sessionId);
    }
  }

  private async flushChanges(sessionId: string): Promise<void> {
    const entry = this.watchers.get(sessionId);
    if (!entry || entry.changeBuffer.length === 0) return;

    const changes = [...entry.changeBuffer];
    entry.changeBuffer = [];

    try {
      // Bulk insert file changes into DB
      await prisma.sessionFile.createMany({
        data: changes.map((c) => ({
          sessionId,
          filePath: c.filePath,
          changeType: c.changeType,
          detectedAt: c.detectedAt,
        })),
      });

      // Update session fileChangeCount
      await prisma.session.update({
        where: { id: sessionId },
        data: { fileChangeCount: { increment: changes.length } },
      });

      // Emit event for each change (WS broadcast)
      for (const change of changes) {
        eventBus.emit("file:changed", {
          sessionId,
          filePath: change.filePath,
          changeType: change.changeType,
        });
      }

      console.log(
        `[file-watcher] Flushed ${changes.length} changes for session ${sessionId}`
      );
    } catch (err) {
      console.error(`[file-watcher] Failed to flush changes:`, err);
    }
  }
}

// Singleton export
export const fileWatcher = new FileWatcher();
