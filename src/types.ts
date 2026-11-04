// Shared types for the harness. This file exports types only. Nothing imports a value from it.
// JavaScript files still write `import("./types.js")` in JSDoc. TypeScript resolves that to this file.
//
// The internal history format is the block format of the Anthropic API. Each provider
// translates to and from this format (src/providers/). Fields that start with "_" are
// private to an adapter (for example _gemini.thoughtSignature) and never go out to another API.

/** A text block in the internal history. */
export type TextBlock = {
  type: "text";
  text: string;
  _gemini?: { thoughtSignature?: string };
  _ollama?: { thinking?: string };
};

/** A tool call in the internal history. */
export type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, any>;
  _gemini?: { thoughtSignature?: string; idPropio?: boolean };
  _ollama?: { idPropio?: boolean; thinking?: string };
};

/** The result of a tool call, sent back to the model. */
export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

/** One block in the internal history. */
export type Block = TextBlock | ToolUseBlock | ToolResultBlock;

/** One message in the internal history. */
export type Message = {
  role: "user" | "assistant";
  content: string | Block[];
};

/** The JSON definition the model sees for a tool. */
export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, any>;
};

/** A tool: the definition the model sees, and the function the harness runs. */
export type Tool = {
  definition: ToolDefinition;
  run: (input: any) => Promise<string>;
};

/** What a provider returns, already in the internal format. */
export type ModelResponse = {
  content: Block[];
  stop_reason: string;
  usage: { input_tokens?: number; output_tokens?: number };
};

/** What the loop passes to a provider for one call. */
export type CallArgs = {
  model: string;
  system: string;
  messages: Message[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  /** Text the provider has ready, as it arrives. Absent on a call that waits for the whole reply. */
  onText?: (delta: string) => void;
};

/**
 * A provider's contract. The last three fields are optional (Ollama uses them).
 * A new provider in JavaScript is checked with `@satisfies {import("../types.js").Provider}`.
 */
export interface Provider {
  name: string;
  label: string;
  keyEnv: string | null;
  model: () => string;
  fastModel: () => string;
  configured: () => boolean;
  call: (args: CallArgs) => Promise<ModelResponse>;
  refresh?: (opts?: { forzar?: boolean }) => Promise<any>;
  contextWindow?: (model: string) => number;
  status?: () => Record<string, any>;
}

/** One layer of the context window, as the inspector shows it. */
export type Layer = { name: string; tokens: number };

/** One event the inspector lists for a turn. */
export type TraceEvent =
  | { type: "compact"; droppedMessages: number; summaryTokens: number }
  | { type: "subagent"; agent: string; calls: number; tools: number }
  | { type: "warning"; text: string };

/** What the chat inspector shows for a turn. */
export type Trace = {
  calls: number;
  tools: { name: string; input: any; tokens: number; agent: string | null }[];
  events: TraceEvent[];
  lastContext: { layers: Layer[]; usage: ModelResponse["usage"] } | null;
  provider?: string;
  model?: string;
  budget?: number;
};

/** harness/routing.json */
export type Routing = {
  contextBudgetTokens: number;
  compactAt: number;
  keepLastMessagesOnCompact: number;
  maxToolLoops: number;
  layers: Record<string, any>;
  agents: Record<string, { tools: string[]; maxToolLoops?: number; model?: "main" | "fast" }>;
};
