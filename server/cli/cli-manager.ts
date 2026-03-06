// Backward-compatible wrapper
// New code should use getLLMProvider().generate() directly from server/llm
import { getLLMProvider } from "../llm";
import type { LLMResult } from "../llm";

export type CLIResult = LLMResult;

export async function executeClaude(
  prompt: string,
  options?: { cwd?: string; timeout?: number }
): Promise<CLIResult> {
  const provider = getLLMProvider();
  return provider.generate(prompt, options);
}

export async function checkCLIAvailable(): Promise<{
  available: boolean;
  path: string | null;
  error: string | null;
}> {
  const provider = getLLMProvider();
  const info = await provider.getInfo();
  return {
    available: info.available,
    path: (info.details?.path as string) ?? null,
    error: info.available ? null : `Provider '${info.name}' not available`,
  };
}
