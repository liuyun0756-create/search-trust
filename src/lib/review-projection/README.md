# Internal review content contracts

Generated from the backend review projection modules. These are **not** a public API, report delivery format, or authorization mechanism. No product route imports this directory.

- `bundle.schema.json`: internal evidence input; trusted server storage must provide source bodies. Do not round-trip legacy snapshot bodies through JavaScript before verifying their original checksums.
- `projection.schema.json`: independently versioned content; `client_actions` and `prior_diagnosis` are controlled reading layers. The whole projection includes private SEO records and must never be published as a client report.
- `difference.schema.json`: semantic evidence/decision differences recomputed from validated inputs.
- `fixtures.json`: constructed examples only, not observed customer outcomes.

Schema checks validate shape, not ownership, source provenance, arithmetic, or approval. The backend replays source validators and derivations. Production atomic freezing, authenticated selection, generation/settlement, PDF and sharing remain unconnected. Existing review guards stay in place.

Regenerate with the backend `scripts/export_v22_review_projection.py --frontend-dir ../search-trust`; run the same command with `--check` to check drift. Types are generated from the output schemas using the project's json2ts utility.
