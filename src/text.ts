// Edit src/text.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Sentences a person reads when something fails. English unless ADA_LANG=es.
// Tool descriptions, index headers, and the compaction prompt are not in here: they travel in the prompt.
// Sandbox path errors stay at the throw site. They are not in this catalog.

const en = {
  missingKey: "Missing {name} in .env",
  geminiNoReply: "Gemini did not reply: {reason}",
  noCandidates: "no candidates",
  geminiFinished: "Gemini finished with {reason}",
  ollamaDown: "Ollama is not responding at {host}. Is it running? Try: ollama serve",
  ollamaTimeout: "not responding",
  ollamaNotFound: "not detected",
  ollamaWhere: "{error} at {host}",
  ollamaNoTools: "no installed model can use tools",
  unknownProvider: "Unknown provider: {name}. Options: {options}",
  invalidJson: "Invalid JSON",
  messageRequired: "message is required",
  hostDenied: "host not allowed",
  originDenied: "origin not allowed",
  wantsJson: "expected content-type application/json",
  outside: "outside app/ and docs/",
  notFound: "not found",
  unknownOption: "unknown option: {name}",
  missingValue: "missing value for {name}",
  oneProvider: "choose one provider: --anthropic, --gemini, or --ollama",
  badPort: "the port must be a number",
  tryHelp: "Try: ada --help",
  openChat: "To open the chat: npm start",
  badSchema: "unsupported schema type at {at}",
  badPattern: "invalid pattern at {at}",
  badProperties: "invalid properties at {at}",
  badRequired: "invalid required at {at}",
  mustBe: "{at} must be {type}",
  mustBeOneOf: "{at} must be one of the allowed values",
  minChars: "{at} must be at least {n} characters",
  maxLength: "{at} exceeds maxLength ({n})",
  patternMiss: "{at} does not match pattern",
  minNum: "{at} must be >= {n}",
  maxNum: "{at} must be <= {n}",
  minItems: "{at} must have at least {n} items",
  maxItems: "{at} exceeds maxItems ({n})",
  requiredKey: "{at} is required",
  notAllowed: "{at} is not allowed",
  invalidInput: "invalid input",
};

const es: Record<keyof typeof en, string> = {
  missingKey: "Falta {name} en .env",
  geminiNoReply: "Gemini no respondió: {reason}",
  noCandidates: "sin candidatos",
  geminiFinished: "Gemini terminó con {reason}",
  ollamaDown: "Ollama no responde en {host}. ¿Está corriendo? Prueba: ollama serve",
  ollamaTimeout: "no responde",
  ollamaNotFound: "no detectado",
  ollamaWhere: "{error} en {host}",
  ollamaNoTools: "ningún modelo instalado usa herramientas",
  unknownProvider: "Proveedor desconocido: {name}. Opciones: {options}",
  invalidJson: "JSON inválido",
  messageRequired: "message requerido",
  hostDenied: "host no permitido",
  originDenied: "origen no permitido",
  wantsJson: "se espera content-type application/json",
  outside: "fuera de app/ y docs/",
  notFound: "no existe",
  unknownOption: "opción desconocida: {name}",
  missingValue: "falta el valor de {name}",
  oneProvider: "elige un solo proveedor: --anthropic, --gemini o --ollama",
  badPort: "el puerto tiene que ser un número",
  tryHelp: "Prueba: ada --help",
  openChat: "Para abrir el chat: npm start",
  badSchema: "tipo de esquema no soportado en {at}",
  badPattern: "pattern inválido en {at}",
  badProperties: "properties inválido en {at}",
  badRequired: "required inválido en {at}",
  mustBe: "{at} debe ser {type}",
  mustBeOneOf: "{at} debe ser uno de los valores permitidos",
  minChars: "{at} debe tener al menos {n} caracteres",
  maxLength: "{at} excede maxLength ({n})",
  patternMiss: "{at} no cumple pattern",
  minNum: "{at} debe ser >= {n}",
  maxNum: "{at} debe ser <= {n}",
  minItems: "{at} debe tener al menos {n} elementos",
  maxItems: "{at} excede maxItems ({n})",
  requiredKey: "{at} es obligatorio",
  notAllowed: "{at} no está permitido",
  invalidInput: "entrada inválida",
};

/**
 * Sentence a person reads when something fails. English unless `ADA_LANG=es`.
 * @param {keyof typeof en} key catalog key
 * @param {Record<string, string | number>} [vars] values for `{name}` placeholders
 * @returns {string}
 */
export function text(key: keyof typeof en, vars: Record<string, string | number> = {}): string {
  const sentence = (process.env.ADA_LANG === "es" ? es : en)[key];
  return sentence.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
}
