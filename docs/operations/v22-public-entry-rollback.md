# V2.2 new-intake operational control

This control pauses or reopens only new V2.2 intake. It does not delete database rows,
change migration history, revoke completed reports, or block payment settlement and
existing Case/report reads.

## Preview first

Run both previews before a release. They print only target names, intended boolean
changes, and post-change checks.

```bash
npm run release:v22:entry -- close
npm run release:v22:entry -- open
```

Neither command changes an external system without `--execute`.

## Close new intake

Use only for an approved production incident. Supply every fixed ID exactly as shown by
the dry-run contract:

```bash
npm run release:v22:entry -- close --execute \
  --confirm-vercel-project=prj_881acLLmpttUjjW1YdFHm3sDCsrD \
  --confirm-railway-project=3e69fdd3-3241-412c-b224-6bf468bc5b15 \
  --confirm-railway-environment=2c547ad1-4cad-44e2-a759-cfc49e1622c3 \
  --confirm-railway-web=f3a526ab-b156-4223-a0ef-c7aa886b3b4f \
  --confirm-railway-worker=fd8d13e2-3546-4bf2-a02a-5f018a0550a8
```

The command waits for Vercel, Railway Web, and Railway Worker. It then requires backend
health HTTP 200, the paused new-Case page, and an unblocked Case read route. A failed
check leaves the system closed for investigation; it never reopens automatically.

## Reopen new intake

Reopening is a separate approved operation. Rerun the same command with `open` and the
same confirmations only after the incident is resolved and the preview is correct.

## Safety boundary

- Vercel: only production `V22_PUBLIC_ENTRY_ENABLED` changes.
- Railway Web: only the analysis, preflight, and competitor-discovery switches change.
- Railway Worker: only the analysis switch changes.
- No Supabase command, SQL, credential read, environment dump, or data-deletion path is
  present.
- Raw environment values and command output are never printed.
