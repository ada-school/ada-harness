// Tipos del harness, en JSDoc: el editor los usa para autocompletar y `npm run typecheck`
// los verifica con TypeScript, sin paso de compilación. Este archivo no ejecuta nada.
//
// El formato interno del historial es el de bloques de la API de Anthropic. Cada proveedor
// traduce desde y hacia este formato (src/providers/). Los campos que empiezan con "_" son
// privados de un adaptador (por ejemplo _gemini.thoughtSignature) y nunca salen hacia otra API.

/**
 * @typedef {{ type: "text", text: string, _gemini?: { thoughtSignature?: string }, _ollama?: { thinking?: string } }} TextBlock
 * @typedef {{ type: "tool_use", id: string, name: string, input: Record<string, any>,
 *             _gemini?: { thoughtSignature?: string, idPropio?: boolean }, _ollama?: { idPropio?: boolean, thinking?: string } }} ToolUseBlock
 * @typedef {{ type: "tool_result", tool_use_id: string, content: string, is_error?: boolean }} ToolResultBlock
 * @typedef {TextBlock | ToolUseBlock | ToolResultBlock} Block
 *
 * @typedef {{ role: "user" | "assistant", content: string | Block[] }} Message
 */

/**
 * @typedef {{ name: string, description: string, input_schema: Record<string, any> }} ToolDefinition
 * @typedef {{ definition: ToolDefinition, run: (input: any) => Promise<string> }} Tool
 */

/**
 * Lo que devuelve un proveedor, ya en formato interno.
 * @typedef {{ content: Block[], stop_reason: string, usage: { input_tokens?: number, output_tokens?: number } }} ModelResponse
 *
 * @typedef {{ model: string, system: string, messages: Message[], tools?: ToolDefinition[], maxTokens?: number }} CallArgs
 *
 * Contrato de un proveedor. Los tres últimos campos son opcionales (los usa Ollama).
 * @typedef {{
 *   name: string,
 *   label: string,
 *   keyEnv: string | null,
 *   model: () => string,
 *   fastModel: () => string,
 *   configured: () => boolean,
 *   call: (args: CallArgs) => Promise<ModelResponse>,
 *   refresh?: (opts?: { forzar?: boolean }) => Promise<any>,
 *   contextWindow?: (model: string) => number,
 *   status?: () => Record<string, any>,
 * }} Provider
 */

/**
 * Lo que el inspector del chat muestra de un turno.
 * @typedef {{ name: string, tokens: number }} Layer
 * @typedef {{ type: "compact", droppedMessages: number, summaryTokens: number }
 *         | { type: "subagent", agent: string, calls: number, tools: number }
 *         | { type: "warning", text: string }} TraceEvent
 * @typedef {{
 *   calls: number,
 *   tools: { name: string, input: any, tokens: number, agent: string | null }[],
 *   events: TraceEvent[],
 *   lastContext: { layers: Layer[], usage: ModelResponse["usage"] } | null,
 *   provider?: string,
 *   model?: string,
 *   budget?: number,
 * }} Trace
 */

/**
 * harness/routing.json
 * @typedef {{
 *   contextBudgetTokens: number,
 *   compactAt: number,
 *   keepLastMessagesOnCompact: number,
 *   maxToolLoops: number,
 *   layers: Record<string, any>,
 *   agents: Record<string, { tools: string[], maxToolLoops?: number, model?: "main" | "fast" }>,
 * }} Routing
 */

export {};
