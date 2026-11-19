# P1-11 页面解析排查与修复设计（2026-11-19，设计已确认）

**1. 本轮结论。** 当前 main：RD `204c0e3`、前端 `18364b7`。只读重放 PR 的原 `bound-p0-10.json.gz`，不替换证据。三个核心页面并非全部解析失败：

| 页面 | HTML 字节 / 节点 / 最大栈深度 | 当前 HTML 判定 | JSON-LD streetAddress |
|---|---|---|---|
| `/` | 76,422 / 2,385 / 14 | `html_parse_failed` | 1504 N Maple Ave |
| `/about-us` | 41,249 / 1,568 / 12 | 无该错误 | 1504 N Maple Ave |
| `/contact-us` | 42,185 / 1,607 / 14 | 无该错误 | 1504 N Maple Ave |

**2. 原因与字段结果。** 首页第1295行（列偏移3）多一个找不到栈内对应起始标签的 `</div>`；`HtmlTree.handle_endtag` 因此把整页标为失败。不是大小或预算问题：限制为每页1,000,000字节、20,000节点、深度64。50个深度页另有 `/testimonials`、`/projects/top-quality-heating-and-air-conditioning-packaged-unit-install` 因被忽略的 SVG 中重复 `fill` 属性而失败；不把它们误称为关于/联系页。核心首页阻塞 `_inspection` 的完整性，故**名称、地址、电话均为 not_checked / site_content_not_checked**（当前代码执行原v11/v12路径）；三页结构化街道与 GBP 的1504 N Maple Ave相同，但这不是系统已判地址一致。当前v17离线投影这三字段也均为not_checked；未经新身份确认时 `operating_location.role=unknown` 还会独立阻塞地址检查，不能靠解析修复绕过。

**3. 是否已被修好。** 没有。解析器自 `769e31c` 起与当前main文件SHA-256相同（`6d90223c…16f98`）；关于/联系页本次本来就不报该错误，不能归功于结构截断复用。`d24b930` 修的是采集阶段结构元数据，既不修旧深度HTML，也不改变此解析器。

**4. 已确认的修复边界。** 仅新版本解析路径：孤立、无匹配起始标签的结束标签不修改树结构，记非阻塞解析诊断；完全被排除的SVG子树内重复属性不扩散为全页联系字段失败。可见内容中的重复属性、错嵌套、未闭合、JSON-LD错误和原预算限制仍保守阻塞；不自动修补HTML、不忽略全部解析错误。保留旧默认路径与冻结校验和。验收须覆盖上述三个真实错误、预算/恶意结构负例、来源定位与证据不变、地址确认前后真实结果、旧版本字节一致。地址修复后的match/mismatch及未检查率改善值均待实测，不预设。

**5. 已执行验证。** 独立worktree中运行 `python ../replay_inputs.py`、`python ../audit_design.py`（使用该worktree的`.venv/bin/python`），追踪器只记录事件、不修树。执行 `scripts/eval_gold.py --private-root /Users/liuyun3/Documents/SearchTurst前后端/.release-private/2026-10-29 --ruleset v22_capability_public_v11 --truth-overlay tests/fixtures/p1-00b-hours/confirmed-truth-overlay.json`：6站errors=[]、误报 **0/35**、字段未检查 **7/26→7/26（26.92%，变化0）**，其中PR贡献3项；这保持原评分口径，不冒称v17基线。执行 `python -m pytest -q tests/test_v22_site_business_extraction.py tests/test_v22_site_business_boundaries.py tests/test_p1_03_landing_pages.py`：**155 passed**。诊断及v17投影的provider/network拦截计数均0，原请求字节相同。产物在工作区 `.release-private/2026-11-19-p1-08-p1-11-design/`（`pr-parser-trace.json`、`pr-parser-current.json`、`pr-v17-projection.json`、`eval-gold-current-v11.json`）。

**6. 设计确认（2026-11-19）。** 负责人确认两类有限容错与P1-08共用v18门控，先实施P1-11、离线重跑PR/六站并记录实际地址结果与未检查率后停下验收；本轮不做P1-08模块、不采集、不扣费、不改开关、不push、不部署。P1-02第二段顺延v19。新增调用0、费用$0；实施结果另见P1-11.md。
