# Controlled report candidates for P6-01

This is a local release-review artifact. It is not imported by marketing routes,
not a deployed entry, and not a customer result. Inputs are deliberately
synthetic `.test` businesses and saved-source data; output is produced by the
actual public/service report builders, not authored report prose.

## Reproduce

From the frontend root, with the sibling `SearchTrust-RD` and its Python venv:

```sh
./node_modules/.bin/tsx scripts/export-site-report-candidates.ts
./node_modules/.bin/tsx scripts/export-site-report-candidates.ts --check
./node_modules/.bin/tsx scripts/build-site-report-preview.ts
node scripts/check-site-report-preview.mjs
```

Open `output/site-report-preview/index.html` directly. It is self-contained and
requires no login, server, analytics, remote fonts, external scripts or API.
The browser checker serves only that file on a temporary loopback port, then
closes its browser and server. Screenshots/results are written beside the HTML.

## Data path

1. Backend `scripts/export_v22_site_candidates.py` constructs controlled inputs
   using existing synthetic source factories and calls the real builders. It
   asserts that the Verified report's parent is the exact Prospect output.
2. FE validates the full report contract and uses the real delivery projection.
3. `project.ts` allowlists display fields, renumbers references and discards
   owner/case/job/snapshot/binding identifiers and the input manifest. Finding
   numbers, observed values, dates, scope, caveats, work, completion and materials
   remain unchanged. No approval or implementation is manufactured.
4. `generated/reports.json` is the display artifact. `manifest.json` records
   raw-source/display hashes, schema, rules and counts. `--check` regenerates
   instead of trusting stored fixture JSON, and fails on drift.
5. The preview uses **the same CapabilityReportDocument** as product delivery.
   Its isolated reader adds tabs, keyboard controls and in-reader chapter links.

The allowlist is **not a customer-data anonymizer**. Free text is preserved.
There is intentionally no CLI option to load arbitrary customer data or URLs.
Any future authorized real source must be separately reviewed for identifiable
text and provenance before creating a marketing artifact.

## Three outcomes

- Prospect: public saved HTTP 503 observation, 1 action.
- Verified: same Case with eligible synthetic GSC/GA4 sources, 3 actions.
- Diagnosis only: separate input variant, 0 actions; findings/evidence/limits
  retained. A completed analysis uses 1 credit with no refund.

These cover report rendering, not all product flows. No first-service release,
provider correctness, empirical calibration, approval/PDF/share, billing or
customer benefit is proven by this preview. Production report and delivery
schemas, IDs and permissions are unchanged; the shared component now accepts
only the fields it actually reads.
