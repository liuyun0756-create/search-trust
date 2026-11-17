# P1-03 rollback

Production original definitions, both md5 baselines and ACLs are recorded in reviews/P1-03.md. Each function is replaced under a baseline guard; no ACL is expanded.

Keep feature switches off. If no v16 reports or in-flight v16 inputs exist, restore these original function definitions and two constraints in one transaction, then drop validate_v22_landing_comparison(jsonb), and verify hashes and ACLs. Otherwise retain v16 readers and use a forward fix; do not delete or rewrite frozen reports/snapshots. No rollback has been executed.
