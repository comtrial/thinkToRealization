import { spawn } from "child_process";
import { readConfig } from "../../db/devflow-config";
import type { LLMProvider, LLMResult, LLMGenerateOptions, LLMProviderInfo } from "../types";

const DEFAULT_TIMEOUT = 120_000;

export class ClaudeCLIProvider implements LLMProvider {
  private cliPath: string;

  constructor() {
    const config = readConfig();
    this.cliPath = config.cliPath || "claude";
  }

  async getInfo(): Promise<LLMProviderInfo> {
    const result = await this.checkAvailability();
    return {
      name: "claude-cli",
      available: result.available,
      localOnly: true,
      details: { path: result.path },
    };
  }

  async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

    return new Promise((resolve) => {
      const args = ["--print", "--output-format", "json", "-p", prompt];

      const proc = spawn(this.cliPath, args, {
        cwd: options?.cwd,
        timeout,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      proc.on("error", (err) => {
        resolve({
          success: false, data: null, rawOutput: stdout,
          error: `CLI spawn error: ${err.message}`, provider: "claude-cli",
        });
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          resolve({
            success: false, data: null, rawOutput: stdout,
            error: stderr || `CLI exited with code ${code}`, provider: "claude-cli",
          });
          return;
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve({ success: true, data: parsed, rawOutput: stdout, error: null, provider: "claude-cli" });
        } catch {
          resolve({ success: true, data: null, rawOutput: stdout, error: "Failed to parse JSON", provider: "claude-cli" });
        }
      });
    });
  }

  private async checkAvailability(): Promise<{ available: boolean; path: string | null }> {
    return new Promise((resolve) => {
      const proc = spawn("which", [this.cliPath], { timeout: 5000 });
      let stdout = "";
      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.on("error", () => resolve({ available: false, path: null }));
      proc.on("close", (code) => {
        resolve(code === 0 ? { available: true, path: stdout.trim() } : { available: false, path: null });
      });
    });
  }
}
