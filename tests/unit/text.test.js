// Error sentences a person reads. English unless ADA_LANG=es. The Spanish side is the sentence the code printed before this change.

import { test } from "node:test";
import assert from "node:assert/strict";
import { text } from "../../dist/src/text.js";
import { validateInput } from "../../dist/src/validation.js";
import { parseArgs } from "../../dist/src/cli.js";

/** @type {Record<string, [string, Record<string, string | number>, string, string]>} */
const FRASES = {
  missingKey: ["missingKey", { name: "ANTHROPIC_API_KEY" }, "Missing ANTHROPIC_API_KEY in .env", "Falta ANTHROPIC_API_KEY en .env"],
  geminiNoReply: ["geminiNoReply", { reason: "no candidates" }, "Gemini did not reply: no candidates", "Gemini no respondió: no candidates"],
  noCandidates: ["noCandidates", {}, "no candidates", "sin candidatos"],
  geminiFinished: ["geminiFinished", { reason: "SAFETY" }, "Gemini finished with SAFETY", "Gemini terminó con SAFETY"],
  ollamaDown: ["ollamaDown", { host: "http://127.0.0.1:11434" }, "Ollama is not responding at http://127.0.0.1:11434. Is it running? Try: ollama serve", "Ollama no responde en http://127.0.0.1:11434. ¿Está corriendo? Prueba: ollama serve"],
  ollamaTimeout: ["ollamaTimeout", {}, "not responding", "no responde"],
  ollamaNotFound: ["ollamaNotFound", {}, "not detected", "no detectado"],
  ollamaWhere: ["ollamaWhere", { error: "no detectado", host: "http://127.0.0.1:9" }, "no detectado at http://127.0.0.1:9", "no detectado en http://127.0.0.1:9"],
  ollamaNoTools: ["ollamaNoTools", {}, "no installed model can use tools", "ningún modelo instalado usa herramientas"],
  unknownProvider: ["unknownProvider", { name: "nope", options: "anthropic, gemini, ollama" }, "Unknown provider: nope. Options: anthropic, gemini, ollama", "Proveedor desconocido: nope. Opciones: anthropic, gemini, ollama"],
  invalidJson: ["invalidJson", {}, "Invalid JSON", "JSON inválido"],
  messageRequired: ["messageRequired", {}, "message is required", "message requerido"],
  hostDenied: ["hostDenied", {}, "host not allowed", "host no permitido"],
  originDenied: ["originDenied", {}, "origin not allowed", "origen no permitido"],
  wantsJson: ["wantsJson", {}, "expected content-type application/json", "se espera content-type application/json"],
  outside: ["outside", {}, "outside app/ and docs/", "fuera de app/ y docs/"],
  notFound: ["notFound", {}, "not found", "no existe"],
  unknownOption: ["unknownOption", { name: "--no-existe" }, "unknown option: --no-existe", "opción desconocida: --no-existe"],
  missingValue: ["missingValue", { name: "model" }, "missing value for model", "falta el valor de model"],
  oneProvider: ["oneProvider", {}, "choose one provider: --anthropic, --gemini, or --ollama", "elige un solo proveedor: --anthropic, --gemini o --ollama"],
  badPort: ["badPort", {}, "the port must be a number", "el puerto tiene que ser un número"],
  tryHelp: ["tryHelp", {}, "Try: ada --help", "Prueba: ada --help"],
  openChat: ["openChat", {}, "To open the chat: npm start", "Para abrir el chat: npm start"],
  badSchema: ["badSchema", { at: "$" }, "unsupported schema type at $", "tipo de esquema no soportado en $"],
  badPattern: ["badPattern", { at: "$" }, "invalid pattern at $", "pattern inválido en $"],
  badProperties: ["badProperties", { at: "$" }, "invalid properties at $", "properties inválido en $"],
  badRequired: ["badRequired", { at: "$" }, "invalid required at $", "required inválido en $"],
  mustBe: ["mustBe", { at: "$.path", type: "string" }, "$.path must be string", "$.path debe ser string"],
  mustBeOneOf: ["mustBeOneOf", { at: "$" }, "$ must be one of the allowed values", "$ debe ser uno de los valores permitidos"],
  minChars: ["minChars", { at: "$", n: 2 }, "$ must be at least 2 characters", "$ debe tener al menos 2 caracteres"],
  maxLength: ["maxLength", { at: "$", n: 80 }, "$ exceeds maxLength (80)", "$ excede maxLength (80)"],
  patternMiss: ["patternMiss", { at: "$" }, "$ does not match pattern", "$ no cumple pattern"],
  minNum: ["minNum", { at: "$", n: 0 }, "$ must be >= 0", "$ debe ser >= 0"],
  maxNum: ["maxNum", { at: "$", n: 10 }, "$ must be <= 10", "$ debe ser <= 10"],
  minItems: ["minItems", { at: "$", n: 1 }, "$ must have at least 1 items", "$ debe tener al menos 1 elementos"],
  maxItems: ["maxItems", { at: "$", n: 8 }, "$ exceeds maxItems (8)", "$ excede maxItems (8)"],
  requiredKey: ["requiredKey", { at: "$.path" }, "$.path is required", "$.path es obligatorio"],
  notAllowed: ["notAllowed", { at: "$.extra" }, "$.extra is not allowed", "$.extra no está permitido"],
  invalidInput: ["invalidInput", {}, "invalid input", "entrada inválida"],
};

test("errores: inglés por defecto y la frase española con ADA_LANG=es", () => {
  const antes = process.env.ADA_LANG;
  try {
    for (const valor of [undefined, "en", "fr"]) {
      if (valor === undefined) delete process.env.ADA_LANG;
      else process.env.ADA_LANG = valor;
      for (const [key, vars, en] of Object.values(FRASES)) assert.equal(text(/** @type {any} */ (key), vars), en, `${valor ?? "unset"} ${key}`);
    }
    process.env.ADA_LANG = "es";
    for (const [key, vars, , es] of Object.values(FRASES)) assert.equal(text(/** @type {any} */ (key), vars), es, key);
    assert.throws(() => validateInput({}, { type: "unknown" }), /tipo de esquema no soportado en \$/);
    assert.match(parseArgs(["--no-existe"]).error || "", /opción desconocida: --no-existe/);
    delete process.env.ADA_LANG;
    assert.throws(() => validateInput({}, { type: "unknown" }), /unsupported schema type at \$/);
    assert.match(parseArgs(["--no-existe"]).error || "", /unknown option: --no-existe/);
    assert.match(parseArgs(["--ollama", "--gemini"]).error || "", /choose one provider/);
    assert.match(parseArgs(["serve", "--port", "no"]).error || "", /the port must be a number/);
  } finally {
    if (antes === undefined) delete process.env.ADA_LANG;
    else process.env.ADA_LANG = antes;
  }
});
