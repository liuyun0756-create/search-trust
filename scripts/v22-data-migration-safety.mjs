import { createHash } from "node:crypto";

export const TARGET_PROJECT = Object.freeze({
  ref: "cmdsbsvcxesnrrealftb",
  name: "searchtrust-production",
  region: "us-east-2",
  status: "ACTIVE_HEALTHY",
});

export const VALIDATION_MODES = Object.freeze(["baseline", "local", "remote", "residue"]);

const SECRET_ENV_NAMES = [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "DODO_API_KEY",
  "DODO_WEBHOOK_SECRET",
  "CLERK_SECRET_KEY",
  "CLERK_WEBHOOK_SIGNING_SECRET",
];

const SENSITIVE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(?:postgres(?:ql)?):\/\/[^\s"']+/gi,
  /\b(?:access_token|refresh_token|service_role_key|api_key|password)\s*[:=]\s*[^\s,}]+/gi,
];

export function parseSupabaseJson(text) {
  const trimmed = String(text).trim();
  const starts = [trimmed.indexOf("{"), trimmed.indexOf("[")].filter((value) => value >= 0);
  if (!starts.length) throw new Error("SUPABASE_JSON_MISSING");
  const parsed = JSON.parse(trimmed.slice(Math.min(...starts)));
  return parsed;
}

export function assertApprovedProject(projects, linkedRef) {
  if (linkedRef !== TARGET_PROJECT.ref) throw new Error("UNAPPROVED_LINKED_PROJECT");
  if (!Array.isArray(projects)) throw new Error("PROJECT_LIST_INVALID");
  const project = projects.find((candidate) => candidate?.id === linkedRef);
  if (!project) throw new Error("LINKED_PROJECT_NOT_FOUND");
  for (const key of ["name", "region", "status"]) {
    if (project[key] !== TARGET_PROJECT[key]) throw new Error(`PROJECT_${key.toUpperCase()}_MISMATCH`);
  }
  return { ...TARGET_PROJECT };
}

export function assertMigrationParity(localVersions, remoteRows) {
  const local = [...localVersions];
  const remote = remoteRows.map((row) => row?.remote).filter(Boolean);
  if (new Set(local).size !== local.length || new Set(remote).size !== remote.length) {
    throw new Error("MIGRATION_VERSION_DUPLICATE");
  }
  if (local.length !== remote.length || local.some((version, index) => version !== remote[index])) {
    throw new Error("MIGRATION_HISTORY_DRIFT");
  }
  if (remoteRows.some((row, index) => row?.local !== local[index])) {
    throw new Error("MIGRATION_LOCAL_REMOTE_MISMATCH");
  }
  return { count: local.length, first: local[0] ?? null, last: local.at(-1) ?? null };
}

function executableSql(sql) {
  return String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function assertTransactionOnlySql(sql) {
  const normalized = executableSql(sql);
  const statements = normalized.split(";").map((value) => value.trim()).filter(Boolean);
  if (statements[0] !== "begin" || statements.at(-1) !== "rollback") {
    throw new Error("REMOTE_SQL_TRANSACTION_REQUIRED");
  }
  if (statements.filter((value) => value === "begin").length !== 1
    || statements.filter((value) => value === "rollback").length !== 1) {
    throw new Error("REMOTE_SQL_TRANSACTION_MULTIPLE");
  }
  if (statements.some((value) => /^(commit|drop\b|truncate\b)/.test(value))) {
    throw new Error("REMOTE_SQL_DESTRUCTIVE_OPERATION");
  }
  if (statements.some((value) => /\bsupabase_migrations\b/.test(value)
    && /\b(insert|update|delete|alter|drop|truncate)\b/.test(value))) {
    throw new Error("REMOTE_SQL_MIGRATION_HISTORY_MUTATION");
  }
  if (statements.some((value) => /^delete\s+from\b/.test(value) && !/\bwhere\b/.test(value))) {
    throw new Error("REMOTE_SQL_UNSCOPED_DELETE");
  }
  if (statements.some((value) => /^update\s+\S+\s+set\b/.test(value) && !/\bwhere\b/.test(value))) {
    throw new Error("REMOTE_SQL_UNSCOPED_UPDATE");
  }
  return { statements: statements.length, digest: sha256(normalized) };
}

export function redactSensitiveText(value, env = process.env) {
  let safe = String(value);
  for (const name of SECRET_ENV_NAMES) {
    const secret = env[name]?.trim();
    if (secret && secret.length >= 8) safe = safe.split(secret).join("[REDACTED]");
  }
  for (const pattern of SENSITIVE_PATTERNS) safe = safe.replace(pattern, "[REDACTED]");
  return safe;
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function commandEvidence(rawOutput, env = process.env) {
  const safe = redactSensitiveText(rawOutput, env);
  return {
    bytes: Buffer.byteLength(safe),
    digest: sha256(safe),
    passed: !/(^|\n)not ok\b/i.test(safe),
  };
}

export function boundedJson(value, maxBytes = 32_768) {
  const output = `${JSON.stringify(value)}\n`;
  if (Buffer.byteLength(output) > maxBytes) throw new Error("VALIDATION_OUTPUT_TOO_LARGE");
  return output;
}
