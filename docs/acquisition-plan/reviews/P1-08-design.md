# P1-08 本地实体覆盖与位置设计（2026-11-19，设计已确认）

**1. 判定建议。** 只检查目标城市，复用P1-03 `landing_page_comparison.extract_content` 的分词边界、大小写/空白归一化、品牌名/前缀排除及可见节点规则，不另写匹配器。现实现每页仅留首条证据，拟增可选位置收集出口，旧默认不变。仅用绑定的成功HTML深度快照及title/H1/text；隐藏、坏节点、导航/页眉/表单不计。品牌内城市不计，另有独立城市仍计。按城市/位置合并引用，重复页脚不增加实体数，按URL、位置稳定排序。

| 已评估档位 | 确定性条件与解释 |
|---|---|
| 有 | 任一有效标题或H1有排除品牌后的城市命中 |
| 位置偏弱 | 无上述命中，但可见正文或页脚有命中；正文/页脚分别留证，不推断排名原因 |
| 未检测到 | 本次绑定的可用抽样页均检查完成，四位置均未命中；只说“本次已检查样本未检测到目标城市”，不声称全站缺失 |

采集失败、无深度页、超预算或解析不完整且无正向命中时为**未检查**，不能塞入负向档位；存在正向命中但部分页不可检查时仍可列位置、标注抽样限制，不作完整覆盖断言。

**2. 七站离线核对（方案投影，非已实现模块）。** RD main `204c0e3`，原冻结输入、P1-03真实函数及只读位置追踪。引文已人工对照保存字段/上下文，仅核实词与位置。

| 样本 / 目标城市 | 已核对位置与原文示例 | 拟档位 |
|---|---|---|
| All Star / Fresno | title “Plumber Fresno CA”；另有H1/正文/页脚 | 有 |
| Nova / Fresno | `/history`正文“founded in November 1999 in Fresno, California”；页脚地址含Fresno；标题/H1无命中 | 位置偏弱 |
| PR / Fresno | 首页title “Plumber Fresno”；另有H1/正文/页脚 | 有 |
| Seamless / Pensacola | 首页title “Gutter Solutions & Home Improvement in Pensacola, FL”；另有H1/正文/页脚 | 有 |
| Vision-Tech / Swansea | `/tag/av-installation-services-swansea`的title/H1；首页正文“technical consultation in Swansea”；无页脚命中 | 有 |
| Volcanoes / Hilo | 冻结site仅选首页、deep_analyzed=false、无deep_snapshot，无法检查 | 未检查 |
| 第六次客户 Fresno Plumbing & Heating / Fresno | title “Local Plumbing Services \| Fresno, CA”；另有正文；已排除品牌内城市 | 有 |

合计**有5、位置偏弱1、未检测到0、未检查1**。Vision-Tech标题/H1仅命中标签归档页，当前范围是全部已选深度页。Volcanoes另存 `page.html` 有H3 “Joining Us from Hilo, Kona or Waikoloa”，但非绑定深度输入，2,141,616字节也超过现1,000,000字节上限；不回填、不放宽、不冒称系统检出，应显示“未检查”，不报“未找到本地内容”。逐页引用/品牌排除记录：工作区 `.release-private/2026-11-19-p1-08-p1-11-design/seven-site-position-audit.json`。

**3. 合约与历史。** 拟新增 `local_entity_coverage_v1`，保存目标城市、状态/档位、各位置及页面证据引用、检查范围/失败原因；不是修改既有finding，不新增行动或排名权重。拟v18 / 报告2.2.13 / 合约2.2.18 / manifest v8，P1-02第二段顺延v19 / 2.2.14 / 2.2.19 / v9。建议 `V22_LOCAL_ENTITY_COVERAGE_ENABLED=false`，仅GBP、LANDING、REASONS均启用时进入v18，无效组合告警并保持现有版本。历史v1–v17生成和三端投影均不变；新模块不改旧证据/checksum。实施时逐函数审计版本白名单，迁移做基准md5/ACL不变/回滚定义校验。

**4. 三端与验收。** 网页/分享/PDF统一档位、引文及“Only the confirmed target city is checked; other places are not assessed.”；顾问展开URL/位置/时点/失败原因，客户隐藏内部ID/路径/技术参数。覆盖四位置、品牌、重复页脚、隐藏/坏节点、空城市、无快照/超限/partial、排序、七站引用及Volcanoes无缺失结论；provider mock=0，历史黄金字节、合约/数据库/三端净化。既有提取测试本轮 **155 passed**，非新模块测试。新增调用0、费用$0。

**5. 设计确认（2026-11-19）。** 负责人确认仅正文命中归“位置偏弱”、Volcanoes本期接受“未检查”；P1-11与P1-08共用v18门控，P1-02第二段顺延v19。先实施P1-11并停下验收。

**实施批准。** P1-08 与 P1-11 共同接入完整 v18。标题或 H1 仅在 tag/category 归档页命中时，顾问版显示 URL 与 “Archive page”，客户版保留原档位。
