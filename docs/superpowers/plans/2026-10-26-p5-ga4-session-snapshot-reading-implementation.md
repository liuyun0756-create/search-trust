# GA4 saved session reading — implementation checklist

Written specification approved by the user on 2026-10-26. The writing-plans skill is unavailable; this checklist follows the repository's existing fallback. No delegation, deployment, provider calls or flag activation.

- [x] Inspect source, existing owner-bound read and original qualification; confirm written spec.
- [x] Capture recovery baseline: `../.v22-capability-baselines/baseline-at4wbq`, manifest SHA256 `3ff1b2a01688c67eb12dba9e046e72d6539411e106c315f5c7470fadb20809e4`.
- [x] Add independent pure session projection, bound read service and default-off internal endpoint; preserve old schemas/checksums.
- [x] Export strict contract and deterministic fixtures; add owner-authenticated frontend GET with bounded responses.
- [x] Thread server-only feature flag to accessible on-demand UI, with neutral numbers, source dates and permanent limitations.
- [x] Test source restrictions, integer/decimal boundaries, auth/flags, readonly behavior, compatibility and stale UI requests.
- [x] Run frontend/backend regression, native isolated database tests, browser checks, typecheck and build; record actual evidence and outstanding gates.

No database migration is planned. Real calibration, paid report integration and production rollout remain separate work.

Results and commands: [local verification](./2026-10-26-v22-capability-p5-ga4-session-reading-verification.md).
