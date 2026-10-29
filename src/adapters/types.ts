export interface CacheCreationSplit {
  ephemeral_5m_input_tokens: number;
  ephemeral_1h_input_tokens: number;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  cache_creation?: CacheCreationSplit;
  server_tool_use?: { web_search_requests?: number; web_fetch_requests?: number };
  /** "fast" when the request ran in fast mode, which is priced at a premium. */
  speed?: string;
  /** "standard" | "batch" | "priority"; batch is billed at a discount. */
  service_tier?: string;
}

/**
 * The few tool_use input fields the audit needs. Kept small on purpose: Write
 * and Edit inputs carry whole file contents, which we never hold on to.
 */
export interface ToolInput {
  filePath?: string;
  offset?: number;
  limit?: number;
  command?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: ToolInput;
}

/** One deduplicated API request (one requestId). */
export interface NormalizedRequest {
  requestId: string;
  model: string;
  timestamp: string;
  usage: Usage;
  /** tool_use blocks emitted by this request (accumulated across its records) */
  toolCalls: ToolCall[];
  /** set if this request came from a subagent log */
  subagent?: string;
}

export type TimelineEvent =
  | { kind: "request"; request: NormalizedRequest }
  | {
      kind: "toolResult";
      toolName: string;
      chars: number;
      timestamp: string;
      /** id of the tool_use this answers; "" when the log omits it */
      toolUseId: string;
      /** the tool reported failure (non-zero exit, missing file, ...) */
      isError: boolean;
    }
  | {
      kind: "userPrompt";
      chars: number;
      timestamp: string;
      /** cleaned one-line preview of what the user typed (absent for harness-injected text) */
      text?: string;
    };

/** One chronological event stream (the main session, or one subagent). */
export interface Stream {
  subagent?: string;
  events: TimelineEvent[];
}

export interface NormalizedSession {
  sessionId: string;
  sourcePath: string;
  requests: NormalizedRequest[];
  streams: Stream[];
  models: string[];
  startTime?: string;
  endTime?: string;
  /** working directory the session ran in, when the log records it */
  cwd?: string;
  skippedLines: number;
  warnings: string[];
}

export interface Adapter {
  name: string;
  detect(path: string): boolean;
  parse(path: string): NormalizedSession;
}
