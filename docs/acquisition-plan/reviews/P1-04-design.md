# P1-04：可能原因设计（2026-11-17，待负责人确认）

**1. 范围与依据。** 只消费P1-02的`gbp_comparison.differences`和P1-03的`landing_page_comparison.comparisons`中已满足门槛的方向差异；不从通用findings、未检查、未检测、截断或limitation推导缺失。沿用身份确认、至少2个有效竞品支持同方向、原始采样时点差≤24h及各指标完整性门槛，不重新降低门槛。类别集合不同不等于优劣；相同、不可比较下限、`no_supported_difference`不生成原因。每个合格metric一条，去重后固定按评分、评论量、已有合格落地页差距排序；不改变既有finding、优先级或action。

**2. 输出与措辞。** 拟增`possible_reasons_v1={status: assessed|not_assessed, items:[{metric, classification: inference, basis_refs, competitor_indices, customer_text}]}`；basis_refs绑定原比较项及双方快照证据，保存原始时点，不复制/改写证据。客户每条统一“很可能是原因之一”（英文使用“may be one contributing factor”），并附“观察差异不能证明排名因果”；不称某竞品确实排在前面，除非同词同渠道已有有效位置证据，亦不把Maps参考带入新客户模块。没有合格差距时三端均显示“未评估 / Not assessed”，不能写“没有问题”。不新增待办或效果承诺。

**3. 第六次离线v16实际输入核对（方案投影，尚未实现）。** job `49c74362`原冻结输入生成的已保存`v16-real-report.json`（SHA-256 `4ad5e6dbee1be9611f7817943f62fb24166032611eaefea3b8ab289522cd4c37`），不是把本轮结构恢复结果回填旧报告。GBP有3项observed，落地页0项合格差距；按本方案产生**2条**：

| 原因候选与客户示例 | 双方依据及门槛 |
|---|---|
| “竞品样本评分为4.8、4.8、4.9，您的评分为4.2。评分差距很可能是原因之一；本次观察不能证明排名因果。” | `gbp_comparison.differences[metric=rating]` observed/higher，竞品1/2/3；客户`dd7b7c25…:/payload/record/fields/rating`，竞品`0f3d9590…:/payload/competitors/{0,1,2}/public_gbp/rating` |
| “竞品样本评论总数为1,868、479、815，您的为117。评论量差距很可能是原因之一；本次观察不能证明排名因果。” | 同上metric=`review_count`，双方同路径的`review_count`；不是30条评论样本数 |

上述客户原始时点02:19:35.027899 UTC、三竞品02:18:55.158964 UTC，同日相差39.869秒；3家均有效。完整snapshot_id及source_refs从原报告继承，缩写仅为本页排版。类别different_categories只列事实，不判“类别不足”；客户评论样本3项未检查，不推因果。落地页page_type_counts为bounded_counts；case_study/portfolio/service_price/discount/project_budget为customer_unchecked；local_entities/credentials为no_supported_difference，全部不生成原因。本轮只读文件核对，供应商/RPC调用0。

**4. 三端、版本与成本。** 网页/分享/PDF用同一客户投影，显示差距数值、商家名、采样日期和推断措辞；顾问可展开双方路径、原时点、门槛与排除原因。客户不含内部ID、规则ID、坐标、设备/语言。拟独立v17 / 报告2.2.12 / 合约2.2.17 / manifest v7；P1-02第二段顺延v18 / 2.2.13 / 2.2.18 / v8。建议`V22_COMPARISON_REASONS_ENABLED=false`，仅GBP和LANDING均启用时才可进入v17；否则保持现有v14/v15/v16选择并告警无效组合。新版本继承v16比较结果，历史v1–v16分支/冻结输入/校验和逐字节不变。实施时审计freeze/store/hydrate/prepare、候选池、关键词/GBP/落地页及身份绑定白名单；迁移逐函数基准md5校验、目标缺失raise、ACL不变，保存原定义供回滚。无需新采集、LLM或数据库表；新增外部调用0、增量费用$0。

**5. 验收与待决。** 覆盖0/1/2竞品、24h边界、身份不可判、方向相反、只有类别差异、样本下限/未检查、partial站点、双方refs缺失、重复与稳定顺序、三端净化；离线49c投影2条，删掉合格依据则降为未评估；provider mock=0，历史黄金/重放不变及三端/数据库/合约测试。**待负责人确认：** 2条投影的口径与措辞、类别差异排除、上述新字段/开关/版本组合。确认前不实现、不执行迁移、不采集、不扣费、不冒烟、不改开关。

**后续扩展（2026-11-17负责人确认）。** P1-02第二段补齐客户评论样本后，可以扩展“近期评论活跃度”：依据至少N条及样本最近日期的下限比较，继续遵守下限重叠不排高低；本期不实施。

**设计确认与验收补充。** 负责人已审阅通过，授权按本设计实施v17。第六次冒烟的2条离线投影基于截断修复前冻结输入，落地页0条合格差距；截断修复上线后的第一次真实冒烟须单独核对落地页比较是否产生新的原因（包括page_type_counts是否满足门槛），结果补入验收记录。该后续冒烟本轮未获授权，不执行，不能把“仍未检查”当成差距。
