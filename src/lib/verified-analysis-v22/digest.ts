import { createHash } from "node:crypto";

function invalidJson(): never {
  throw new TypeError("Canonical digests require finite, acyclic plain JSON values.");
}

function ownValue(value: object, key: string): unknown {
  const property = Object.getOwnPropertyDescriptor(value, key);
  if (!property?.enumerable || !("value" in property)) return invalidJson();
  return property.value;
}

function canonicalJson(value: unknown, ancestors: WeakSet<object>): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (!value || typeof value !== "object") return invalidJson();
  if (ancestors.has(value)) return invalidJson();
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return invalidJson();
  // JSON has only own enumerable string data properties; never invoke accessors
  // or silently discard symbols, hidden properties, sparse slots or array extras.
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) return invalidJson();
  ancestors.add(value);
  try {
    if (array) {
      if (keys.length !== value.length + 1) return invalidJson();
      const items: string[] = [];
      for (let index = 0; index < value.length; index++) {
        items.push(canonicalJson(ownValue(value, String(index)), ancestors));
      }
      return `[${items.join(",")}]`;
    }
    return `{${Object.getOwnPropertyNames(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(ownValue(value, key), ancestors)}`).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

/** Hash the loaded JSON value, never PostgreSQL's jsonb text serialization. */
export function canonicalDigest(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(canonicalJson(value, new WeakSet()), "utf8").digest("hex")}`;
}
