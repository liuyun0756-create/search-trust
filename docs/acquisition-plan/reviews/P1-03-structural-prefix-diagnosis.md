# P1-03 前置排查：结构前缀截断（只读，2026-11-17）

来源：第六次 job `49c74362-4d53-46e1-bee3-20059fc7da85` 已保存的175个Redis key和冻结输入。逐份验证完整响应的base64及body_checksum。外部调用0，未写Redis、冻结文件或生产数据。

| 页面路径 | 完整HTTP正文 B | 结构前缀 B |
|---|---:|---:|
| `/` | 865,071 | 256,000 |
| `/careers` | 773,777 | 256,000 |
| `/english-application` | 930,782 | 256,000 |
| `/spanish-application` | 960,208 | 256,000 |
| `/waterheaters` | 699,990 | 256,000 |
| `/service-department` | 865,554 | 256,000 |
| `/backflow-testing` | 663,998 | 256,000 |
| `/about` | 674,374 | 256,000 |
| `/residential-projects` | 653,943 | 256,000 |
| `/new-construction` | 759,195 | 256,000 |
| `/commercial-projects` | 650,374 | 256,000 |
| `/sewer-inspection-video-recording` | 666,123 | 256,000 |
| `/re-piping` | 665,958 | 256,000 |
| `/leak-detection` | 666,674 | 256,000 |
| `/privacy-policy` | 638,626 | 256,000 |

## 生效分支与原因

- 默认结构上限256,000 B，深采上限2,000,000 B。checkpoint键含max_bytes和prefix分支；15份fetch_v2均truncated=true、正文256000 B；同URL另有非截断fetch_v1完整响应。上表是解码HTTP正文长度，不是清洗后HTML长度。
- Worker客户：resource_limits=true、sampling_quality=true、contact_coverage=true；竞品：resource_limits=true、sampling_quality=true、contact_coverage=false。根页只要resource_limits开启就allow_prefix=true；普通候选在resource_limits且不属于contact_urls时allow_prefix=true；已识别联系页用4 MB、不允许前缀。
- 客户`/contact-us`完整701,015 B，是唯一未截断结构页。深采遇到前缀会重取完整正文；contact_coverage的首页/联系页深采用4 MB，其余2 MB。
- 页面确实较大：15页为638,626–960,208 B。256 KB只够链接发现，尚不足这些页面的完整结构分析。contact_coverage只解释联系页为何例外，没有额外压低普通页面上限。竞品同一结构上限下没有命中截断，不能外推为所有网站均适合256 KB。

## 独立修复方案（本轮不实施）

1. 优先考虑在新采集版本中，复用已成功深采、同URL的完整响应派生结构元数据，仍校验域名、媒体类型和资源预算，不改旧checkpoint或冻结数据。
2. 或将客户结构上限升到1,000,000 B，本样本15页均可容纳；保留prefix兜底和“截断不得产生事实”，单独验证候选发现及选页变化，不改50/10或40 MB冻结上限。
3. 上述均涉及采集逻辑，须另立任务和交付；本轮只给方案。P1-03仍使用现有数据，结构合格数保持1，深采正证据可用。

## 离线容量估算（非真实RPC）

按现行HTTPX编码重建RPC，两边同样留空cost_counters，使用等长租约UUID。只将15页已有完整响应恢复为结构元数据，保持原深采选择、HTML和来源时间。签名/checksum更新为固定长度，不影响差量。

| 方案 | RPC B（未含两边相同的cost台账） | 增量 |
|---|---:|---:|
| 原冻结输入重建 | 33,719,610 | — |
| 只恢复结构元数据 | 33,726,724 | 7,114 |

额外读取正文合计7,294,647 B，但结构记录不存正文，深采中已有完整HTML，因此freeze只增加约7 KB。以33.7 MB实测为锚点约33.707 MB。**这不是重新发现/选页后的容量保证**；分类和链接变多可能改变深采集合，仍受40,000,000 B硬上限保护。未在生产或本地执行测试性freeze。

实际命令：隔离RD环境的`.venv/bin/python ../diagnose-structural.py`。结果provider_calls=0；冻结导出SHA-256仍为`f77f2ff793b2f2b9e4ae66557d8f994ab83ae80509333dd6246c20604cc857ba`。脚本及JSON测量保存在私有目录，不提交客户HTML。
