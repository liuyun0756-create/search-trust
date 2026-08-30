// Test-only corpus loader; never imported by the runtime validator.
type JsonRecord = Record<string, unknown>;

export interface ValidationCase {
  id: string;
  fixture: string;
  operations: unknown[];
  accepted: boolean;
  error?: { code: string; path: string };
}

function requireCase(condition: unknown): asserts condition {
  if (!condition) throw new Error("Invalid v2.2 validation case");
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonRecord, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function member(container: unknown, key: unknown, adding = false): unknown {
  if (isRecord(container)) {
    requireCase(typeof key === "string" && !["__proto__", "prototype", "constructor"].includes(key));
    requireCase(adding || Object.hasOwn(container, key));
    return container[key];
  }
  requireCase(Array.isArray(container) && typeof key === "number" && Number.isInteger(key) && key >= 0 && key < container.length);
  return container[key];
}

export function applyOperations(base: unknown, operations: unknown): unknown {
  requireCase(Array.isArray(operations));
  const result: unknown = structuredClone(base);
  for (const operation of operations) {
    requireCase(isRecord(operation));
    const kind = operation.op;
    requireCase(kind === "set" || kind === "remove" || kind === "reorder_keys");
    requireCase(exactKeys(operation, kind === "set" ? ["op", "path", "value"] : kind === "remove" ? ["op", "path"] : ["op", "path", "keys"]));
    const path = operation.path;
    requireCase(Array.isArray(path) && path.length > 0);
    let parent = result;
    for (const part of path.slice(0, -1)) parent = member(parent, part);
    const key = path.at(-1) as string | number;
    const target = member(parent, key, kind === "set");
    const record = parent as Record<string | number, unknown>;
    if (kind === "set") {
      record[key] = structuredClone(operation.value);
    } else if (kind === "remove") {
      if (Array.isArray(parent)) parent.splice(key as number, 1);
      else delete record[key];
    } else {
      const keys = operation.keys;
      requireCase(isRecord(target) && Array.isArray(keys) && keys.every((item) => typeof item === "string"));
      requireCase(keys.length === Object.keys(target).length && new Set(keys).size === keys.length && keys.every((item) => Object.hasOwn(target, item)));
      record[key] = Object.fromEntries(keys.map((item) => [item, target[item]]));
    }
  }
  return result;
}

export function loadValidationCases(document: unknown, fixtures: Record<string, unknown>): ValidationCase[] {
  requireCase(isRecord(document) && exactKeys(document, ["version", "cases"]) && document.version === 1);
  requireCase(Array.isArray(document.cases) && document.cases.length > 0);
  const seen = new Set<string>();
  for (const value of document.cases) {
    requireCase(isRecord(value) && typeof value.accepted === "boolean");
    requireCase(exactKeys(value, value.accepted ? ["id", "fixture", "operations", "accepted"] : ["id", "fixture", "operations", "accepted", "error"]));
    requireCase(typeof value.id === "string" && /^[a-z][a-z0-9_]*$/.test(value.id) && !seen.has(value.id));
    seen.add(value.id);
    requireCase(typeof value.fixture === "string" && Object.hasOwn(fixtures, value.fixture));
    if (!value.accepted) {
      const error = value.error;
      requireCase(isRecord(error) && exactKeys(error, ["code", "path"]));
      requireCase(error.code === "REPORT_CONTRACT_INVALID" || error.code === "REPORT_REFERENCE_INVALID");
      requireCase(typeof error.path === "string" && error.path.startsWith("/"));
    }
    applyOperations(fixtures[value.fixture], value.operations);
  }
  return document.cases as ValidationCase[];
}
