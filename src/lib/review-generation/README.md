# Internal review generation contracts

These files describe a backend-only preparation/content boundary. They are not a browser generation API, authorization proof, completed `2.2.2` report, delivery approval, or billing receipt.

The reference recipe binds one saved review and one exact saved decision revision. Backend resolution rechecks owner/Case access and reconstructs the same complete input. `prepared_at` does not replace evidence evaluation/freeze dates. The internal content remains `requires_delivery_review` and is deliberately rejected by existing report completion.

Client candidates expose approved facts and generic decision status. Private SEO reasons, new/adjusted work text and implementation notes are not automatically published. The eventual report/delivery integration must explicitly handle approval and rendering; do not route this internal object to a public response.

Regenerate/check both repositories from SearchTrust-RD:

```sh
.venv/bin/python scripts/export_v22_review_generation.py --frontend-dir ../search-trust
.venv/bin/python scripts/export_v22_review_generation.py --frontend-dir ../search-trust --check
```

The fixture is synthetic test material, imported only by tests. Runtime generation must resolve saved owner-bound records. JSON schema checks shape; backend binding, digest, source replay and deterministic content checks are still required.
