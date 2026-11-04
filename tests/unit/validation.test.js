import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInput } from "../../dist/src/validation.js";

const schema = {
  type: "object",
  properties: {
    path: { type: "string", minLength: 1, maxLength: 80 },
    args: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 8 },
  },
  required: ["path"],
  additionalProperties: false,
};

test("validateInput acepta una entrada que cumple el esquema", () => {
  assert.deepEqual(validateInput({ path: "src/main.js", args: ["--help"] }, schema), []);
});

test("validateInput reporta propiedades desconocidas y tipos incorrectos", () => {
  const errors = validateInput({ path: 17, unexpected: true }, schema);
  assert.ok(errors.some((e) => e.includes("path")));
  assert.ok(errors.some((e) => e.includes("unexpected")));
});

test("validateInput limita longitud, tamaño de arreglos y valores enum", () => {
  const errors = validateInput({ path: "x".repeat(81), args: Array(9).fill("ok") }, schema);
  assert.ok(errors.some((e) => e.includes("maxLength")));
  assert.ok(errors.some((e) => e.includes("maxItems")));
  assert.deepEqual(validateInput("no", { type: "string", enum: ["si", "no"] }), []);
  assert.ok(validateInput("talvez", { type: "string", enum: ["si", "no"] }).some((e) => e.includes("allowed")));
});

test("validateInput distingue integer de number y rechaza no finitos", () => {
  assert.deepEqual(validateInput(3, { type: "integer" }), []);
  assert.deepEqual(validateInput(3, { type: "number", minimum: 0, maximum: 10 }), []);
  assert.ok(validateInput(1.5, { type: "integer" }).some((e) => e.includes("integer")));
  assert.ok(validateInput(NaN, { type: "number" }).some((e) => e.includes("number")));
});

test("validateInput falla cerrado ante un esquema mal formado", () => {
  assert.throws(() => validateInput({}, { type: "unknown" }), /unsupported schema type/);
  assert.throws(() => validateInput({}, { type: "object", required: "path" }), /invalid required/);
  assert.throws(() => validateInput("x", { type: "string", pattern: "(" }), /invalid pattern/);
});
