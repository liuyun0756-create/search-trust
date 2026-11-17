# 客户结构截断复用修复（独立交付，2026-11-17）

## 改动

本修复独立于P1-03规则/展示。采用负责人批准的方案1：已经成功完整深采、同一规范URL的响应可派生结构元数据。复用发生在本次深采成功后，仍校验请求URL、最终域名/安全URL、2xx、HTML媒体类型、未截断及原深采字节预算；不加一次请求。保存的是小型结构记录，不额外持有完整响应正文。

- RD `app/collectors/site_inventory_reuse.py`：纯元数据派生与安全边界，保留原record类型。
- RD `app/collectors/site_inventory.py`：从成功深采响应恢复title/h1/canonical/meta_robots/schema_types/internal_links及现有分类；保持实际选页顺序、评分/选页依据、深采HTML和内容checksum。未获得完整响应的页继续structural_truncated=true，不作缺失结论。
- RD `app/jobs_v22/site_inventory_stage.py`：生产resource_limits采集启用修复；新checkpoint命名空间`site_inventory_v5:<原版本>`。HTTP/Firecrawl原始响应在新key miss时只读复用旧raw key，沿原校验器验证；只写新命名空间，不读旧最终snapshot作为新结果、不覆盖旧值/TTL。保留原版本区分contact/sampling分支。
- RD `tests/test_v22_site_inventory_deep_structure.py`：成功/安全负例/资源预算、缺深采保持截断、客户和竞品、无额外fetch、选页不变、新key/旧key不变、重复复用及生产工厂测试。
- RD `scripts/replay_v22_structural_reuse.py`：可重跑的本地离线工具；同job原始key、原输入文件哈希、provider禁止、完整采集器和generation_recipe验证。输出只允许本地output或私有目录，不执行RPC。

没有修改分类规则、竞品50/10、40,000,000B整包上限或256,000B结构HTTP前缀上限。本样本客户原500/50也保持不变。新internal_links仅入结构记录，不再扩展候选或重新安排深采，避免额外采集。

## 版本与历史兼容

不需要新inventory schema或SQL迁移。现有v2/v3本就表示完整与截断记录；只在新采集版本产出字段齐全、structural_truncated=false的已有合法形状。v14/v15/v16的生成算法和对应manifest/report版本不变；新采集输入的结构事实可以变化，历史冻结输入/报告不会被改写或回填。现有resource_limits=false的采集路径及显式旧stage参数保持原行为。

## 第六次真实checkpoint离线验收

job49c74362原175个key与已保存冻结输入；所有delegate HTTP/Firecrawl及httpx发送被mock禁止。先按旧行为完整执行collector，结果与原冻结客户snapshot逐字节一致，然后用新行为再次完整执行；不是只补一份JSON。原始导出文件哈希前后不变。

| 合格HTML（eligible_html）类型 | 修复前 | 修复后 |
|---|---:|---:|
| home | 0 | 1 |
| contact | 1 | 1 |
| about | 0 | 1 |
| legal | 0 | 1 |
| service_detail | 0 | 2 |
| other | 0 | 10 |
| 合计 | 1 | 16 |

这里统计已检查且2xx/HTML/非截断的样本，不表示全站总数。旧`structurally_checked_count`字段原来就包含前缀记录，仍为16；不能把它说成1→16。全部结构记录原分布home1/contact1/about1/legal1/other12；新分布如上。2个service_detail来自完整标题/H1经现有分类器识别，分类规则本身未改。

深采选页16个URL与顺序完全不变，页类型可按新结构同步更新；HTML与content_checksum逐项不变。保留原始采样时点，未重新采集、未改旧checkpoint。新key复用35份已有raw checkpoint，provider mock=0。

| 离线重建RPC编码 | 修复前 B | 修复后 B |
|---|---:|---:|
| 两边相同空cost_counters | 33,719,610 | 33,726,624 |
| 两边相同已保存最终台账counters | 33,721,928 | 33,728,942 |

增量7,014B，最终整包距40,000,000B上限余6,271,058B。使用当前freeze_json_bytes（同HTTPX编码）和真实generation_recipe校验：新来源payload_checksum、identity/generation/manifest checksum只在本地派生输入里重算；原文件不动。租约UUID等长占位，最终台账时点与真正freeze前可能略异，因此这是明确条件下的离线入参体积，不冒充一次真实freeze；没有调用数据库或供应商。

## 自测

- `.venv/bin/python -m pytest -q tests/test_v22_site_inventory_deep_structure.py tests/test_v22_site_inventory_stage.py tests/test_v22_site_inventory_collector.py tests/test_p1_00b_contact_collection.py`：39 passed（新增14项）。
- `.venv/bin/python scripts/run_v22_backend_quality.py fast`：最终4414 passed /16 skipped /265 deselected，290.80s。未修改原测试断言；跳过沿原私有/集成条件。
- `.venv/bin/python scripts/check_v22_report_goldens.py`：通过，三份报告哈希原样。
- `.venv/bin/python scripts/export_v22_landing_comparison_fixtures.py --check --frontend-dir ../frontend`、GBP同类导出：均通过，旧v15/v16夹具未修改。
- 私有history-check.py：真实既存v14 canonical/checksum、上轮v15及v16报告字节均不变；v1–v13基准断言随fast通过。
- 实际离线命令（隔离RD目录）：`.venv/bin/python scripts/replay_v22_structural_reuse.py --frozen-export ../../2026-11-17-p1-02-phase1/frozen-export.json --redis-export ../../2026-11-17-p1-02-design-revision/redis-export.json.gz --output-dir ../offline-replay`。provider=0、基线字节一致、1→16、选页/HTML/checksum不变、整包<40MB全部断言通过。
- 本地初次测试夹具把前缀记录留有schema/meta，被现有严格模型拒绝；已只修新夹具。首轮离线重放的sitemap预算未按代码默认值设置，被mock禁止并停止；校准现有默认参数后基线逐字节一致。没有放宽产品校验或补采。

## 成本与上线

修复本身不安排额外provider调用；正常新采集仍按原预算。离线验证0次，费用0。无SQL迁移、前端产品或开关/配置变更，按负责人无迁移分支走独立PR→CI全绿→合并→部署；不操作生产数据库。PR/CI及部署证据在完成后补记。

## 待决问题

无。P1-04设计将在此修复交付完成后开始，本文件不实现P1-04。

---
## 验收（由负责人填写）
