/**
 * LLM Provider interface
 *
 * All LLM providers implement this interface.
 * Agnostic to implementation (CLI, API, local model).
 */

export interface LLMGenerateOptions {
  /** Working directory (used in CLI mode) */
  cwd?: string;
  /** Timeout in ms */
  timeout?: number;
  /** Force JSON response */
  jsonMode?: boolean;
}

export interface LLMResult {
  success: boolean;
  /** Parsed response (in JSON mode) */
  data: unknown | null;
  /** Raw text response */
  rawOutput: string;
  /** Error message (on failure) */
  error: string | null;
  /** Which provider handled the request */
  provider: string;
}

export interface LLMProviderInfo {
  /** Provider identifier */
  name: string;
  /** Whether available */
  available: boolean;
  /** Local-only provider */
  localOnly: boolean;
  /** Additional details (version, path, etc.) */
  details?: Record<string, unknown>;
}

export interface LLMProvider {
  /** Get provider info */
  getInfo(): Promise<LLMProviderInfo>;

  /** Execute prompt and return result */
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult>;
}
