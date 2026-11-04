// Edit src/validation.ts. Node runs the compiled file under dist/. Rebuild with npm run build.
// Tool arguments are checked with Ajv. The sentences the model reads stay in src/text.ts.

import { Ajv, type ErrorObject } from "ajv";
import { text } from "./text.js";

const ajv = new Ajv({ allErrors: true, strict: true });
const TYPES = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);

/** @param {string} at @param {string} instancePath @param {string} [extra] @returns {string} */
function place(at: string, instancePath: string, extra?: string): string {
  let loc = at;
  for (const seg of instancePath.split("/").filter(Boolean)) loc += /^\d+$/.test(seg) ? `[${seg}]` : `.${seg}`;
  return extra ? `${loc}.${extra}` : loc;
}

/** @param {unknown} err @param {string} at @returns {Error} */
function schemaError(err: unknown, at: string): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/regular expression|\bpattern\b/i.test(msg)) return new Error(text("badPattern", { at }));
  if (/\brequired\b/.test(msg)) return new Error(text("badRequired", { at }));
  if (/\bproperties\b/.test(msg)) return new Error(text("badProperties", { at }));
  return new Error(text("badSchema", { at }));
}

/** @param {import("ajv").ErrorObject} err @param {string} at @returns {string} */
function inputError(err: ErrorObject, at: string): string {
  const loc = place(at, err.instancePath);
  const n = typeof err.params.limit === "number" ? err.params.limit : 0;
  switch (err.keyword) {
    case "type": return text("mustBe", { at: loc, type: String(err.params.type) });
    case "additionalProperties": return text("notAllowed", { at: place(at, err.instancePath, String(err.params.additionalProperty)) });
    case "required": return text("requiredKey", { at: place(at, err.instancePath, String(err.params.missingProperty)) });
    case "enum": return text("mustBeOneOf", { at: loc });
    case "minLength": return text("minChars", { at: loc, n });
    case "maxLength": return text("maxLength", { at: loc, n });
    case "pattern": return text("patternMiss", { at: loc });
    case "minimum": return text("minNum", { at: loc, n });
    case "maximum": return text("maxNum", { at: loc, n });
    case "minItems": return text("minItems", { at: loc, n });
    case "maxItems": return text("maxItems", { at: loc, n });
    default: return `${loc} ${err.message ?? err.keyword}`; // ponytail: map this keyword when a tool schema uses it
  }
}

/**
 * Validates an input and returns errors the model can read. An invalid schema throws.
 * @param {any} value
 * @param {Record<string, any>} schema
 * @param {string} [at]
 * @returns {string[]}
 */
export function validateInput(value: any, schema: Record<string, any>, at: string = "$"): string[] {
  // Ajv accepts a schema with no type. A tool schema without a known type is malformed.
  if (!schema || typeof schema !== "object" || Array.isArray(schema) || !TYPES.has(schema.type)) {
    throw new Error(text("badSchema", { at }));
  }
  let validate;
  try {
    validate = ajv.compile(schema);
  } catch (err) {
    throw schemaError(err, at);
  }
  if (validate(value)) return [];
  return (validate.errors ?? []).map((err: ErrorObject) => inputError(err, at));
}
