import type { LLMProvider } from "./types";
import { ClaudeCLIProvider } from "./providers/claude-cli";

/**
 * LLM Provider Factory
 *
 * Priority:
 *   1. LLM_PROVIDER env var (explicit)
 *   2. Default: claude-cli
 *
 * To add a new provider:
 *   1. Create implementation in server/llm/providers/
 *   2. Register in registry below
 *   3. Done -- no caller changes needed
 */

type ProviderFactory = () => LLMProvider;

const registry: Record<string, ProviderFactory> = {
  "claude-cli": () => new ClaudeCLIProvider(),
};

let cachedProvider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  const explicit = process.env.LLM_PROVIDER;
  if (explicit && registry[explicit]) {
    cachedProvider = registry[explicit]();
    return cachedProvider;
  }

  // Default: claude-cli
  cachedProvider = registry["claude-cli"]();
  return cachedProvider;
}

/** Reset provider cache (for testing) */
export function resetLLMProvider(): void {
  cachedProvider = null;
}
