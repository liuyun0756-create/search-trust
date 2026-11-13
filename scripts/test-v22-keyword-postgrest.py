"""Isolated real PostgreSQL/PostgREST regression. No provider/production access.

Requires the already installed Docker images. It bounds the 40001 reproduction
to 1.2 seconds, tears down that PostgREST process, then verifies the real patched
RPC and frontend repository/handler. All local containers are removed in finally.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/p1-01/smoke-defects-20261113"
FIX = "20261113100000_stop_keyword_conflict_retries.sql"
OWNER = "11111111-1111-4111-8111-111111111111"
CASE = "22222222-2222-4222-8222-222222222222"
NETWORK = "st-p101-real-rpc-test"
PG = "st-p101-real-rpc-pg"
REST = "st-p101-real-rpc-rest"
resources = []


def run(args, source=None):
    result = subprocess.run(args, input=source, text=True, capture_output=True, cwd=ROOT)
    if result.returncode:
        raise RuntimeError(result.stderr[-2000:])
    return result.stdout.strip()


def sql(source):
    return run(["docker", "exec", "-i", PG, "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], source)


def literal(value):
    return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"


def counter():
    return int(sql("select case when is_called then last_value else 0 end from rpc_attempts;"))


def start_rest():
    run(["docker", "run", "-d", "--name", REST, "--network", NETWORK, "-p", "127.0.0.1::3000",
         "-e", "PGRST_DB_URI=postgres://postgres:local-only@pg:5432/postgres", "-e", "PGRST_DB_ANON_ROLE=service_role",
         "-e", "PGRST_DB_POOL=1", "-e", "PGRST_DB_PRE_REQUEST=public.count_rpc_attempt", "-e", "PGRST_DB_SCHEMAS=public",
         "public.ecr.aws/supabase/postgrest:v14.5"])
    resources.append(("container", REST))
    port = json.loads(run(["docker", "inspect", "--format", "{{json .NetworkSettings.Ports}}", REST]))["3000/tcp"][0]["HostPort"]
    url = "http://127.0.0.1:" + port
    for _ in range(100):
        try:
            # Readiness invokes only the local counter, not OpenAPI generation
            # for the full migration catalog. Reset its sequence immediately.
            probe = urllib.request.Request(url + "/rpc/count_rpc_attempt", data=b'{}', headers={"content-type": "application/json"})
            with urllib.request.urlopen(probe, timeout=1) as response:
                response.read()
            break
        except (OSError, urllib.error.URLError):
            time.sleep(.1)
    else:
        raise RuntimeError("Isolated PostgREST did not become ready")
    sql("alter sequence rpc_attempts restart with 1;")
    return url


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    run(["docker", "network", "create", NETWORK]); resources.append(("network", NETWORK))
    run(["docker", "run", "-d", "--name", PG, "--network", NETWORK, "--network-alias", "pg", "--cpus", "1", "--memory", "768m",
         "-e", "POSTGRES_PASSWORD=local-only", "postgres:17.6-bookworm"]); resources.append(("container", PG))
    for _ in range(200):
        if subprocess.run(["docker", "exec", PG, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], capture_output=True).returncode == 0:
            break
        time.sleep(.1)
    else:
        raise RuntimeError("Isolated PostgreSQL did not become ready")
    sql("create role anon;create role authenticated;create role service_role bypassrls;")
    for file in sorted((ROOT / "supabase/migrations").glob("*.sql")):
        if file.name != FIX:
            sql(file.read_text())
    market = dict(display_name="Austin, TX", country_code="US", region="TX", city="Austin", postal_code=None, latitude=None, longitude=None)
    identity = dict(business_name="Local test", site_url="https://example.com/", normalized_domain="example.com", operating_model="storefront", primary_location=market, public_gbp_url=None)
    queries = ["plumber Austin", "best plumber Austin", "plumber near me"]
    scope = dict(primary_service="Plumbing", target_market=market)
    v1 = dict(schema_version="v22_planning_settings_v1", priority=None, target_pages=[], execution_conditions=dict(capacity="unknown", publishing_access="unknown"))
    v2 = dict(v1, schema_version="v22_planning_settings_v2", target_keywords=[dict(query=q, origin="seo", suggestion_refs=[]) for q in queries], keyword_scope=scope, keyword_confirmation=None)
    sql(f"insert into users(id,clerk_user_id,email,credit_balance) values('{OWNER}','local-rpc','local@example.invalid',3);"
        f"insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market) values('{CASE}','{OWNER}','https://example.com/','example.com','Local test',{literal(identity)},'storefront','Plumbing',{literal(market)});"
        f"select save_v22_case_planning_settings('{OWNER}','{CASE}',0,{literal(v1)});select save_v22_case_planning_settings('{OWNER}','{CASE}',1,{literal(v2)});")
    # Sequence updates survive rollback. This instrumentation is local only and
    # lives in PostgREST's transaction pre-request, leaving the RPC unchanged.
    sql("create sequence rpc_attempts;create function count_rpc_attempt() returns void language plpgsql security definer as $$begin perform nextval('rpc_attempts');perform pg_sleep(0.005);end$$;grant usage on schema public to service_role;grant execute on function count_rpc_attempt() to service_role;")
    url = start_rest()
    body = dict(p_user_id=OWNER, p_case_id=CASE, p_workflow_id="33333333-3333-4333-8333-333333333333", p_discovery_job_id="44444444-4444-4444-8444-444444444444",
                p_workflow_idempotency_key="keyword-conflict-workflow", p_task_idempotency_key="keyword-conflict-task", p_planning_revision=1,
                p_queries_canonical=json.dumps(queries, separators=(",", ":")), p_keyword_scope=scope)
    def request():
        return urllib.request.Request(url + "/rpc/start_v22_prospect_discovery_with_keywords", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    try:
        urllib.request.urlopen(request(), timeout=1.2)
        raise AssertionError("Baseline unexpectedly returned instead of reproducing retries")
    except (TimeoutError, socket.timeout):
        attempts = counter()
        time.sleep(.2)
        after_disconnect = counter()
    assert attempts > 1 and after_disconnect > attempts
    run(["docker", "rm", "-f", REST]); resources.remove(("container", REST))
    sql((ROOT / "supabase/migrations" / FIX).read_text())
    url = start_rest()
    started = time.monotonic()
    try:
        urllib.request.urlopen(request(), timeout=3)
        raise AssertionError("Stale revision unexpectedly succeeded")
    except urllib.error.HTTPError as error:
        raw_status = error.code; raw_body = json.loads(error.read())
    assert raw_status == 400 and raw_body["code"] == "P0001" and raw_body["message"] == "PLANNING_SETTINGS_CONFLICT"
    patched_attempts = counter(); assert patched_attempts == 1
    sql("alter sequence rpc_attempts restart with 1;")
    env = dict(os.environ, V22_LOCAL_KEYWORD_POSTGREST_URL=url)
    result = subprocess.run(["npx", "vitest", "run", "src/lib/database/v22KeywordConflict.test.ts", "--maxWorkers=1"], cwd=ROOT, env=env, text=True, capture_output=True)
    (OUT / "postgrest-handler-tests.log").write_text(result.stdout + result.stderr)
    assert result.returncode == 0, result.stdout[-4000:] + result.stderr[-1000:]
    handler_attempts = counter(); assert handler_attempts == 1
    state = json.loads(sql(f"select json_build_object('balance',(select credit_balance from users where id='{OWNER}'),'charges',(select count(*) from workflow_charges),'ledger',(select count(*) from credit_ledger),'tasks',(select count(*) from prospect_discovery_tasks));"))
    assert state == dict(balance=3, charges=0, ledger=0, tasks=0)
    report = dict(postgres=sql("show server_version;"), postgrest="v14.5", baseline_http_requests=1, baseline_attempts=attempts,
                  baseline_attempts_after_client_disconnect=after_disconnect, patched_http_status=raw_status, patched_error=raw_body,
                  patched_attempts=patched_attempts, frontend_handler_status=409, handler_rpc_attempts=handler_attempts,
                  patched_check_elapsed_ms=round((time.monotonic()-started)*1000), state=state, provider_calls=0, production_calls=0)
    (OUT / "postgrest-integration.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    try:
        main()
    finally:
        OUT.mkdir(parents=True, exist_ok=True)
        if ("container", REST) in resources:
            logs = subprocess.run(["docker", "logs", REST], capture_output=True, text=True)
            (OUT / "isolated-postgrest.log").write_text(logs.stdout + logs.stderr)
        for kind, name in reversed(resources):
            subprocess.run(["docker", "rm", "-f", name] if kind == "container" else ["docker", "network", "rm", name], capture_output=True)
