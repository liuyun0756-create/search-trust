# A3 migration audit

Restore the original definitions only before storing v21 reports. Once stored, disable new v21 generation and retain readers and frozen proofs.

| Function | Before prosrc md5 | New prosrc md5 | ACL retained |
|---|---|---|---|
| `begin_v22_acquisition_preparation(uuid,uuid,uuid,text,uuid,text)` | 52974b3e20b6e48f2fccf7cf81f06417 | c552a160f16d680f5877e55130537faa | `{postgres=X/postgres,service_role=X/postgres}` |
| `check_v22_acquisition_preparation_binding()` | 6ccda16035beaa2295294312946f000b | a7b580ab49bd47e691d0714f3b657eff | `{postgres=X/postgres,service_role=X/postgres}` |
| `enforce_v22_delivery_prerequisites()` | ea5bbd5bb2d13703f6c24347b96190ff | 38fa04c7fbfaeed6717ca885e0bbc47e | `{postgres=X/postgres}` |
| `freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)` | f7765af77b2f63627f05c22197aa7770 | b570b42a415e852ebf420210d3f80ff6 | `{postgres=X/postgres,service_role=X/postgres}` |
| `get_v22_completed_plan_source(uuid,uuid,uuid)` | b18f8c8b763e4da941a397fdb5b2aa88 | 877ea62bdcc7322363938e4f5d9b6e8d | `{postgres=X/postgres}` |
| `hydrate_v22_capability_generation_input(jsonb,jsonb)` | c570a9440f929a9f1b0b484479be7d2f | ef22b646f4ba90b364e7acc175a57e30 | `{postgres=X/postgres}` |
| `list_v22_completed_capability_reports(uuid)` | 6950b9316ce591e0865a5d6e41aaa3f4 | e0b6181f3aee5ac5dbe721bf12247112 | `{postgres=X/postgres,service_role=X/postgres}` |
| `prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)` | f2adf04713918cfd7c76c9d22bca1bab | 4639d97f0df2dcbe623d258143cf1bea | `{postgres=X/postgres}` |
| `prepare_v22_public_reassessment(uuid,uuid,uuid,uuid,jsonb,text)` | da9350d5fa8819cafaca21936aaaca75 | dcd19f685b1c09b95c09a58ff98ee90e | `{postgres=X/postgres,service_role=X/postgres}` |
| `save_v22_report_content_revision(uuid,uuid,uuid,jsonb)` | 5a91a7178eb64e426432b3e02b27ac9c | 38b98afa2a148d6c6cbbca7e262414ae | `{postgres=X/postgres}` |
| `store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)` | d572f0259d97e4387b3571445989bd5e | 5cf5e7bd11e77a91dc871033a466b81b | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_action_advice(jsonb)` | 781dbabaa9d7fc052f9e7089cc59696e | 5409ccf0bfdf87f56f44bed573da6fde | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_candidate_pool(jsonb)` | c3c09663d8b75ad17f8c35fe972b1215 | 25aea0e4348fe8b88edb7db8e621dac4 | `{postgres=X/postgres}` |
| `validate_v22_candidate_selection(jsonb,jsonb)` | 1c357bf64c945e897b0f85ad5c4a4761 | 3d6097ac3c8f81e71380023c6e6c1069 | `{postgres=X/postgres}` |
| `validate_v22_gbp_comparison(jsonb)` | fbb49257bd7342006707fbb41737f4b2 | 11f8dd4be0107003131ab6ed0d5fdab4 | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_keyword_visibility(jsonb)` | 9002c0028e876da46324e5d3718d175c | 8b82367e401fc438f70670762621339c | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_landing_comparison(jsonb)` | 867130da045a7b67bf2a6a2d1a68835c | 32512981319e07687544e7931f9b4608 | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_local_entity_coverage(jsonb)` | 5da5ca2a6ea78c3dbdee4c6d0973e2c8 | 6cd989fe2c4292c9a6315b173ac6dd2d | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_possible_reasons(jsonb)` | faa69f555c2ba7a3b35f755dd766d5b3 | 8e1972d9941adf78324acf5e134ece9d | `{postgres=X/postgres,service_role=X/postgres}` |
