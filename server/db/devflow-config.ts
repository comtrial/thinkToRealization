import fs from "fs";
import path from "path";
import os from "os";

const DEVFLOW_DIR = path.join(os.homedir(), ".devflow");
const CONFIG_PATH = path.join(DEVFLOW_DIR, "config.json");
const PROJECTS_DIR = path.join(DEVFLOW_DIR, "projects");

interface DevflowConfig {
  cliPath: string;
  defaultProjectDir: string;
}

const DEFAULT_CONFIG: DevflowConfig = {
  cliPath: "claude",
  defaultProjectDir: "",
};

/**
 * Ensure ~/.devflow/ directory structure exists.
 * Called on server startup.
 */
export function initDevflowDir(): void {
  // Create ~/.devflow/
  if (!fs.existsSync(DEVFLOW_DIR)) {
    fs.mkdirSync(DEVFLOW_DIR, { recursive: true });
  }

  // Create ~/.devflow/projects/
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }

  // Create config.json with defaults if missing
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }
}

/**
 * Read ~/.devflow/config.json
 */
export function readConfig(): DevflowConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    initDevflowDir();
    return DEFAULT_CONFIG;
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

/**
 * Ensure project-specific plan directory exists.
 * Returns the plans directory path.
 */
export function ensureProjectPlanDir(projectId: string): string {
  const planDir = path.join(PROJECTS_DIR, projectId, "plans");
  if (!fs.existsSync(planDir)) {
    fs.mkdirSync(planDir, { recursive: true });
  }
  return planDir;
}

export { DEVFLOW_DIR, CONFIG_PATH, PROJECTS_DIR };
