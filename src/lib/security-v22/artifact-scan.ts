import { copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { unzipSync } from "fflate";

export interface ArtifactScanResult {
  filesScanned: number;
  secretValuesChecked: number;
  findings: Array<{ file: string; marker: "[REDACTED]" }>;
  ok: boolean;
}

export interface PreparedArtifactResult extends ArtifactScanResult {
  filesCopied: number;
  bytesCopied: number;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const SENSITIVE_TEXT_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /(?:[?&]|\b)(?:code|access_token|refresh_token|id_token|code_verifier)=([A-Za-z0-9._~+/%=-]{8,})/i,
  /\/share#[A-Za-z0-9_-]{43}\b/,
  /(?:authorization|access_token|refresh_token|id_token|client_secret)["']?\s*[:=]\s*["'][A-Za-z0-9._~+/=-]{8,}["']/i,
] as const;

async function files(root: string): Promise<string[]> {
  let entries;
  try { entries = await readdir(root); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const result: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry);
    const metadata = await stat(absolute);
    if (metadata.isDirectory()) result.push(...await files(absolute));
    else if (metadata.isFile()) result.push(absolute);
  }
  return result;
}

function contentsForScan(file: string, content: Buffer): Buffer[] {
  if (path.extname(file).toLowerCase() !== ".zip") return [content];
  try {
    return Object.values(unzipSync(content)).map((value) => Buffer.from(value));
  } catch {
    // An unreadable archive cannot be proven safe for upload.
    return [Buffer.from("authorization: Bearer unreadable-archive")];
  }
}

function hasSensitiveContent(file: string, content: Buffer, markers: readonly string[]): boolean {
  if (content.byteLength > MAX_FILE_BYTES) return true;
  return contentsForScan(file, content).some((part) => {
    const text = part.toString("utf8");
    return markers.some((marker) => text.includes(marker))
      || SENSITIVE_TEXT_PATTERNS.some((pattern) => pattern.test(text));
  });
}

function normalizedMarkers(markers: readonly string[]): string[] {
  return [...new Set(markers.filter((value) => value.length >= 8))];
}

export async function scanArtifacts(root: string, markers: readonly string[]): Promise<ArtifactScanResult> {
  const safeMarkers = normalizedMarkers(markers);
  const artifactFiles = await files(root);
  const findings: ArtifactScanResult["findings"] = [];
  for (const absolute of artifactFiles) {
    const content = await readFile(absolute);
    if (hasSensitiveContent(absolute, content, safeMarkers)) {
      findings.push({ file: path.relative(root, absolute), marker: "[REDACTED]" });
    }
  }
  return {
    filesScanned: artifactFiles.length,
    secretValuesChecked: safeMarkers.length,
    findings,
    ok: findings.length === 0,
  };
}

export async function prepareArtifactUpload(
  sourceRoot: string,
  targetRoot: string,
  markers: readonly string[],
): Promise<PreparedArtifactResult> {
  const safeMarkers = normalizedMarkers(markers);
  const artifactFiles = await files(sourceRoot);
  const findings: ArtifactScanResult["findings"] = [];
  let filesCopied = 0;
  let bytesCopied = 0;

  await rm(targetRoot, { recursive: true, force: true });
  await mkdir(targetRoot, { recursive: true });

  for (const absolute of artifactFiles) {
    const relative = path.relative(sourceRoot, absolute);
    const content = await readFile(absolute);
    if (hasSensitiveContent(absolute, content, safeMarkers) || bytesCopied + content.byteLength > MAX_UPLOAD_BYTES) {
      findings.push({ file: relative, marker: "[REDACTED]" });
      continue;
    }
    const destination = path.join(targetRoot, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(absolute, destination);
    filesCopied += 1;
    bytesCopied += content.byteLength;
  }

  return {
    filesScanned: artifactFiles.length,
    secretValuesChecked: safeMarkers.length,
    findings,
    ok: findings.length === 0,
    filesCopied,
    bytesCopied,
  };
}
