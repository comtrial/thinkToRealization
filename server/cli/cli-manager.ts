import { spawn } from "child_process";
import { readConfig } from "../db/devflow-config";

export interface CLIResult {
  success: boolean;
  data: unknown | null;
  rawOutput: string;
  error: string | null;
}

const DEFAULT_TIMEOUT = 120_000; // 120 seconds

/**
 * Execute `claude --print` with the given prompt and return parsed output.
 * Uses --output-format json for structured responses.
 */
export async function executeClaude(
  prompt: string,
  options?: {
    cwd?: string;
    timeout?: number;
  }
): Promise<CLIResult> {
  const config = readConfig();
  const cliPath = config.cliPath || "claude";
  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  return new Promise((resolve) => {
    const args = ["--print", "--output-format", "json", "-p", prompt];

    const proc = spawn(cliPath, args, {
      cwd: options?.cwd,
      timeout,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        data: null,
        rawOutput: stdout,
        error: `CLI spawn error: ${err.message}`,
      });
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          data: null,
          rawOutput: stdout,
          error: stderr || `CLI exited with code ${code}`,
        });
        return;
      }

      // Try to parse JSON from stdout
      try {
        const parsed = JSON.parse(stdout);
        resolve({
          success: true,
          data: parsed,
          rawOutput: stdout,
          error: null,
        });
      } catch {
        // JSON parse failed — return raw output as data
        resolve({
          success: true,
          data: null,
          rawOutput: stdout,
          error: "Failed to parse CLI output as JSON",
        });
      }
    });
  });
}

/**
 * Check if the Claude CLI is available on the system.
 */
export async function checkCLIAvailable(): Promise<{
  available: boolean;
  path: string | null;
  error: string | null;
}> {
  const config = readConfig();
  const cliPath = config.cliPath || "claude";

  return new Promise((resolve) => {
    const proc = spawn("which", [cliPath], {
      timeout: 5000,
    });

    let stdout = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.on("error", () => {
      resolve({ available: false, path: null, error: `Could not find '${cliPath}' in PATH` });
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({ available: true, path: stdout.trim(), error: null });
      } else {
        resolve({ available: false, path: null, error: `'${cliPath}' not found in PATH` });
      }
    });
  });
}
