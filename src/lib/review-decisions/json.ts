/** Reject duplicate keys, non-finite numbers and excessive nesting before JSON.parse. */
export function strictJson(text: string): unknown {
  let i = 0;
  const fail = (): never => {
    throw new Error("INVALID");
  };
  const ws = () => {
    while (/[\x20\t\r\n]/.test(text[i] ?? "x")) i++;
  };
  function string(): string {
    const start = i++;
    while (i < text.length) {
      if (text[i] === "\\") {
        i += 2;
        continue;
      }
      if (text[i++] === '"') return JSON.parse(text.slice(start, i));
    }
    return fail();
  }
  function value(depth: number) {
    if (depth > 64) fail();
    ws();
    if (text[i] === '"') {
      string();
      return;
    }
    if (text[i] === "{" || text[i] === "[") {
      const object = text[i++] === "{",
        end = object ? "}" : "]",
        keys = new Set<string>();
      ws();
      if (text[i] === end) {
        i++;
        return;
      }
      for (;;) {
        ws();
        if (object) {
          if (text[i] !== '"') fail();
          const key = string();
          if (keys.has(key)) fail();
          keys.add(key);
          ws();
          if (text[i++] !== ":") fail();
        }
        value(depth + 1);
        ws();
        if (text[i] === end) {
          i++;
          return;
        }
        if (text[i++] !== ",") fail();
      }
    }
    const token = text
      .slice(i)
      .match(
        /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/,
      )?.[0];
    if (!token) fail();
    const parsed = JSON.parse(token!);
    if (typeof parsed === "number" && !Number.isFinite(parsed)) fail();
    i += token!.length;
  }
  value(0);
  ws();
  if (i !== text.length) fail();
  return JSON.parse(text);
}
export async function boundedJson(message: Request | Response, limit: number) {
  const reader = message.body?.getReader();
  if (!reader) throw new Error("INVALID");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return strictJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
export const byteSize = (raw: unknown) =>
  new TextEncoder().encode(JSON.stringify(raw)).length;
