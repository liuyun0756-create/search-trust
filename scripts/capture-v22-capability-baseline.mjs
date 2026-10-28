// Local, read-only repository capture. Does not load credentials, contact services,
// apply migrations, reset files, stage changes or create commits.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositories = { FE: frontend, BE: path.resolve(frontend, "../SearchTrust-RD") };
// Keep source copies outside either repository so tsc/Next cannot compile them.
const archiveRoot = path.resolve(frontend, "../.v22-capability-baselines");
mkdirSync(archiveRoot, { recursive: true });
const destination = mkdtempSync(path.join(archiveRoot, "baseline-"));
const git = (root, ...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const allowed = (name) => !/(^|\/)(\.env[^/]*|node_modules|output|\.next|\.venv|\.git)(\/|$)/.test(name)
  && !/(credential|secret|private[-_]key|\.pem$|\.key$)/i.test(name)
  && /^(src\/|app\/|tests?\/|e2e\/|docs\/|scripts\/|contracts\/|supabase\/|public\/|[^/]+\.(json|toml|ts|mts|mjs|js|md|txt|lock))/.test(name);
const manifest = { capturedAt: new Date().toISOString(), destination, purpose: "P0 local recovery baseline; not deployment evidence", repositories: {} };

for (const [label, root] of Object.entries(repositories)) {
  const out = path.join(destination, label);
  mkdirSync(out);
  const changed = git(root, "diff", "--name-only", "-z", "HEAD").split("\0").filter(Boolean);
  const untracked = git(root, "ls-files", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean);
  const names = [...new Set([...changed, ...untracked])].sort();
  const snapshots = [];
  for (const name of names) {
    if (!allowed(name)) { snapshots.push({ path: name, captured: false, reason: "Excluded generated/private or non-source path" }); continue; }
    const source = path.join(root, name);
    if (!existsSync(source)) { snapshots.push({ path: name, deleted: true }); continue; }
    if (!lstatSync(source).isFile()) { snapshots.push({ path: name, captured: false, reason: "Not a regular file" }); continue; }
    const target = path.join(out, "files", name);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
    snapshots.push({ path: name, captured: true, sha256: sha256(readFileSync(source)) });
  }
  const tracked = changed.filter(allowed);
  const patch = tracked.length ? git(root, "diff", "--binary", "HEAD", "--", ...tracked) : "";
  writeFileSync(path.join(out, "tracked.patch"), patch);
  const migrations = path.join(root, "supabase/migrations");
  manifest.repositories[label] = {
    root, branch: git(root, "branch", "--show-current").trim(), commit: git(root, "rev-parse", "HEAD").trim(),
    status: git(root, "status", "--short", "--untracked-files=all"),
    patchSha256: sha256(patch), snapshots,
    sourceMigrations: existsSync(migrations) ? readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort() : [],
    databaseAppliedVersion: "not queried", deploymentVersion: "not queried",
  };
}
writeFileSync(path.join(destination, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(path.join(destination, "RECOVERY.md"), "# P0 local recovery snapshot\n\nCompare files against manifest checksums before restoring individual paths. This is not a full repository or database backup. Excluded paths remain untouched in the original workspace. Do not reset the worktree or apply the patch over subsequent work. Git HEAD identifies committed content; files/ preserves captured working-tree content, including untracked files; tracked.patch documents changes relative to HEAD. The original Git index is not changed or reconstructed.\n");
console.log(JSON.stringify({ destination, manifestSha256: sha256(readFileSync(path.join(destination, "manifest.json"))), repositories: Object.fromEntries(Object.entries(manifest.repositories).map(([label, value]) => [label, { commit: value.commit, captured: value.snapshots.filter((item) => item.captured).length, excluded: value.snapshots.filter((item) => item.captured === false).length }])) }, null, 2));
