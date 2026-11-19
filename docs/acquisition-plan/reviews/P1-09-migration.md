# P1-09 v20 迁移核对表

`20261119110000_add_action_advice_v20.sql` 从完整本地迁移链取得基线，替换函数定义前核对 `prosrc` 和 `pg_get_functiondef` 的 MD5，执行后再次核对并确保 ACL 不变。基线的 17 个 `prosrc` 对齐上一轮只读生产读回。新增校验函数仅 postgres 与 service_role 有执行权。回滚定义在 `docs/acquisition-plan/rollback/20261119110000/`，应先检查是否已写入 v20 行，再由负责人决定回滚方式。v19 的版本号保持预留。

| 函数 | 基线 prosrc MD5 | 目标 prosrc MD5 | 基线定义 MD5 | 目标定义 MD5 |
|---|---|---|---|---|
| `check_v22_acquisition_preparation_binding` | `69e04a08e050f379d093b978cce1ea59` | `6ccda16035beaa2295294312946f000b` | `66839ee6958656fee884649824f97f93` | `eb3a93fa608c8547641bc6d9b8d14fd8` |
| `enforce_v22_delivery_prerequisites` | `a8ac53b46740b5aea057eccf84b57574` | `ea5bbd5bb2d13703f6c24347b96190ff` | `048defbf583ff11205fd2929b9cff579` | `d3b6d324634673ff72c44f08433fc793` |
| `freeze_v22_analysis_manifest` | `6a6a4f69a71ba2eac10424f3b69c6397` | `f7765af77b2f63627f05c22197aa7770` | `95249e4df132810f4a41394c80ca127b` | `02006f638ef65f53f8116ae90a926729` |
| `get_v22_completed_plan_source` | `172f228fee8b2ab9755662b185c0b882` | `b18f8c8b763e4da941a397fdb5b2aa88` | `4999e57ce90bfa2f16f18110792a1011` | `00e51f429b6e19380df377d1dae155a4` |
| `hydrate_v22_capability_generation_input` | `2817cb748ab207890ff068739bb1db6e` | `c570a9440f929a9f1b0b484479be7d2f` | `be855b1c7b054de2ebd67d498ab154c7` | `458c732a46ccbf1671c2a16633d2e855` |
| `list_v22_completed_capability_reports` | `470f2a10a8cc32ae0a0cc5b9e6b8f2be` | `6950b9316ce591e0865a5d6e41aaa3f4` | `70e37eba9f81816a3c4c4645e9715662` | `aeb06d5e15fc006bb2af5785c66d6e2d` |
| `prepare_v22_capability_analysis_input_core` | `e881b99c1b2faf962c9ac335a2a5ceb8` | `f2adf04713918cfd7c76c9d22bca1bab` | `b53b65aa05a9d18e78de571f88873c7f` | `36152bfd22b17033e07db1a27861f9a4` |
| `prepare_v22_public_reassessment` | `ac8ddc791a6ade70ddc08e9cc021cd18` | `da9350d5fa8819cafaca21936aaaca75` | `b71dfb77c3f11bb6b12d3432c778ec14` | `f48e7da63cd581065a2c87fb817219e3` |
| `save_v22_report_content_revision` | `3c8eb295206779d7016e1731c313c9fe` | `5a91a7178eb64e426432b3e02b27ac9c` | `a250d9decfbadf0667854413ffab55a3` | `1883f9c53bac6b0e37900e4796556453` |
| `store_v22_capability_report` | `0ce899788f1a050b789c5f8fefe04093` | `d572f0259d97e4387b3571445989bd5e` | `20702f4b4f8691635a27cf3b63130b8a` | `73477a140d0406edccafec15b18e4bff` |
| `validate_v22_candidate_pool` | `86d3af83fdb9ae75710029d6ed9b2c76` | `c3c09663d8b75ad17f8c35fe972b1215` | `193f6ed3393588cf8f24e4d0cb2d01ba` | `db5c2f952cd122383e926826f50a9711` |
| `validate_v22_candidate_selection` | `2cc38134e2eac87e0a8cb7a4ab1aed12` | `1c357bf64c945e897b0f85ad5c4a4761` | `a56409eb0d56927911ea52d9dcacc5ab` | `d7ee8d78b2c4c4b88518bab3c128921f` |
| `validate_v22_gbp_comparison` | `26317a2fb8571ecbf5689018e881f49f` | `e183e708caa775a59fe745a5ee9266ec` | `d79c0865791160217f5eb12c414e2a4a` | `9d9711583b39ddeebf6198cb81ad742a` |
| `validate_v22_keyword_visibility` | `63449c99e91833b4fefc2cc3507fd912` | `9002c0028e876da46324e5d3718d175c` | `49bf2f673b33adbb6b8846aa992b0b73` | `409689159eecb869681c52f7f419fb69` |
| `validate_v22_landing_comparison` | `ed017fb5e894566114e6b8dd5d056893` | `867130da045a7b67bf2a6a2d1a68835c` | `9f40f85e1b1a017fe130296e0fa1a9de` | `7984aed02eead420d22a8dfa0434fa0c` |
| `validate_v22_local_entity_coverage` | `f7c2311e8d2909fa41e0c5308a88db7d` | `5da5ca2a6ea78c3dbdee4c6d0973e2c8` | `b6296db1b4aac8425b00cc3b7fde71a4` | `819599f3a7e0815605865060a51f2956` |
| `validate_v22_possible_reasons` | `a998df6f12d953e859db25061298a68b` | `faa69f555c2ba7a3b35f755dd766d5b3` | `16955995827a4f1090a5ab454811d64f` | `25b02d2e6fca3f545e6cda062a9d172b` |
| `validate_v22_action_advice` | 新增 | `781dbabaa9d7fc052f9e7089cc59696e` | 新增 | `3e8ba72f0694fab849447fe17678101a` |

| 函数 | 迁移前 ACL | 本地迁移后 ACL |
|---|---|---|
| `check_v22_acquisition_preparation_binding` | `{postgres=X/postgres}` | `{postgres=X/postgres}` |
| `enforce_v22_delivery_prerequisites` | `{postgres=X/postgres}` | `{postgres=X/postgres}` |
| `freeze_v22_analysis_manifest` | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `get_v22_completed_plan_source` | `{postgres=X/postgres}` | `{postgres=X/postgres}` |
| `hydrate_v22_capability_generation_input` | `{postgres=X/postgres}` | `{postgres=X/postgres}` |
| `list_v22_completed_capability_reports` | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `prepare_v22_capability_analysis_input_core` | `{postgres=X/postgres}` | `{postgres=X/postgres}` |
| `prepare_v22_public_reassessment` | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `save_v22_report_content_revision` | `{postgres=X/postgres}` | `{postgres=X/postgres}` |
| `store_v22_capability_report` | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_candidate_pool` | `{postgres=X/postgres}` | `{postgres=X/postgres}` |
| `validate_v22_candidate_selection` | `{postgres=X/postgres}` | `{postgres=X/postgres}` |
| `validate_v22_gbp_comparison` | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_keyword_visibility` | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_landing_comparison` | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_local_entity_coverage` | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_possible_reasons` | `{postgres=X/postgres,service_role=X/postgres}` | `{postgres=X/postgres,service_role=X/postgres}` |
| `validate_v22_action_advice` | 新增 | `{postgres=X/postgres,service_role=X/postgres}` |

完整本地迁移链上的目标 MD5 和 ACL 均匹配。生产执行后需按同一张表逐项比对。
