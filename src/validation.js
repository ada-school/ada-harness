// Validador pequeño del subconjunto JSON Schema que usa el registro de herramientas.
// La validación ocurre en el servidor, aunque el proveedor también revise los argumentos.

const TYPES = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);

/**
 * Valida una entrada y devuelve errores legibles para el modelo. Un esquema inválido lanza error.
 * @param {any} value
 * @param {Record<string, any>} schema
 * @param {string} [at]
 * @returns {string[]}
 */
export function validateInput(value, schema, at = "$") {
  if (!schema || typeof schema !== "object" || Array.isArray(schema) || !TYPES.has(schema.type)) {
    throw new Error(`tipo de esquema no soportado en ${at}`);
  }
  const errors = [];
  const type = schema.type;
  const matches = type === "null" ? value === null
    : type === "array" ? Array.isArray(value)
      : type === "object" ? value !== null && typeof value === "object" && !Array.isArray(value)
        : type === "integer" ? Number.isInteger(value)
          : type === "number" ? typeof value === "number" && Number.isFinite(value)
            : typeof value === type;
  if (!matches) return [`${at} debe ser ${type}`];

  if (schema.enum && (!Array.isArray(schema.enum) || !schema.enum.some((v) => Object.is(v, value)))) {
    errors.push(`${at} debe ser uno de los valores permitidos`);
  }
  if (type === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at} debe tener al menos ${schema.minLength} caracteres`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${at} excede maxLength (${schema.maxLength})`);
    if (schema.pattern !== undefined) {
      let pattern;
      try { pattern = new RegExp(schema.pattern); } catch { throw new Error(`pattern inválido en ${at}`); }
      if (!pattern.test(value)) errors.push(`${at} no cumple pattern`);
    }
  }
  if (type === "number" || type === "integer") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${at} debe ser >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${at} debe ser <= ${schema.maximum}`);
  }
  if (type === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${at} debe tener al menos ${schema.minItems} elementos`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${at} excede maxItems (${schema.maxItems})`);
    if (schema.items) value.forEach((item, i) => errors.push(...validateInput(item, schema.items, `${at}[${i}]`)));
  }
  if (type === "object") {
    const properties = schema.properties || {};
    if (typeof properties !== "object" || Array.isArray(properties)) throw new Error(`properties inválido en ${at}`);
    if (schema.required !== undefined && !Array.isArray(schema.required)) throw new Error(`required inválido en ${at}`);
    for (const key of schema.required || []) if (!(key in value)) errors.push(`${at}.${key} es obligatorio`);
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) errors.push(...validateInput(child, properties[key], `${at}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${at}.${key} no está permitido`);
    }
  }
  return errors;
}
