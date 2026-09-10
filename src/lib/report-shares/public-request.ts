import { isReportShareToken } from "./tokens";

const MAX_SHARE_REQUEST_BYTES = 1024;

export async function readShareToken(request: Request): Promise<string | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_SHARE_REQUEST_BYTES) return null;

  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_SHARE_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }

  try {
    const body = JSON.parse(text) as { token?: unknown };
    return typeof body.token === "string" && isReportShareToken(body.token) ? body.token : null;
  } catch {
    return null;
  }
}
