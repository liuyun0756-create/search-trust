# P5 review evidence projection — implementation checklist

Written specification approved on 2026-10-26. writing-plans is unavailable; use the repository checklist convention. No delegation, external calls, paid analysis, new routes, migration, deployment or flag activation.

- [x] Inspect existing contracts and source validators; confirm written design.
- [x] Capture recovery baseline for both dirty repositories: `../.v22-capability-baselines/baseline-NFjukS`, manifest SHA256 `8bcd378988b5b7548dfb2dca185d5a71ecf0ba68961c86ee5a0572a95e0bb255`.
- [x] Implement strict versioned bundle, exact source binding, independent decision validation and bounded pure parsing.
- [x] Reuse existing page/GSC/GA4 rules to assemble four report sections and private/client projections.
- [x] Implement semantic evidence/decision differences with baseline and incompatible-source states.
- [x] Add deterministic fixtures, export schemas to both repositories, and validate frontend contract samples without a public entry.
- [x] Test identity/hash/time/size boundaries, missing/restricted data, action decisions, privacy, deterministic replay and semantic differences.
- [x] Run targeted and full regression, contract checks, typecheck/build; record actual results and remaining gates in [local verification](./2026-10-26-v22-capability-p5-review-projection-verification.md).

Acceptance follows the approved spec. No new browser/database workflow is claimed: production atomic freezing, authentication and paid Verified generation remain the next batch. Existing review guards and 1-credit completion policy remain untouched.
