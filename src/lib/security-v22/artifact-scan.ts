import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface ArtifactScanResult {
  filesScanned: number;
  secretValuesChecked: number;
  findings: Array<{ file: string; marker: string }>;
  ok: boolean;
}

async function files(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root)) {
    const absolute = path.join(root, entry);
    const metadata = await stat(absolute);
    if (metadata.isDirectory()) result.push(...await files(absolute));
    else if (metadata.isFile()) result.push(absolute);
  }
  return result;
}

export async function scanArtifacts(root: string, markers: readonly string[]): Promise<ArtifactScanResult> {
  const safeMarkers = [...new Set(markers.filter((value) => value.length >= 8))];
  const artifactFiles = await files(root);
  const findings: Array<{ file: string; marker: string }> = [];
  for (const absolute of artifactFiles) {
    const content = await readFile(absolute);
    const text = content.toString("utf8");
    for (const marker of safeMarkers) {
      if (text.includes(marker)) findings.push({ file: path.relative(root, absolute), marker: "[REDACTED]" });
    }
  }
  return {
    filesScanned: artifactFiles.length,
    secretValuesChecked: safeMarkers.length,
    findings,
    ok: findings.length === 0,
  };
}
