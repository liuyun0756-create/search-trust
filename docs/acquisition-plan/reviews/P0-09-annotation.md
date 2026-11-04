# P0-09 第 4–5 步：金标准答案草稿与第一版基线（2026-11-04，起草：Claude）

**状态：草稿，待负责人确认。** 6 个站的 `truth.json` 已填写，`reviewed_by` 均为 `claude-draft (待负责人确认)`，尚未提交。依据只来自保存的快照（页面 HTML、GBP、SERP 样本）。唯一例外是 Volcanoes 的评分短链：那一项是实时跳转核对的，结论填 null。

## 第一版基线（草稿口径，`eval_gold.py` 全量，退出 0）
| 站点 | 可判定发现 | 误报 | 误报率 | 字段未检查率 |
|---|---|---|---|---|
| Nova | 4 | 0 | 0% | 25% |
| PR Plumbing | 7 | 1 | 14% | 75% |
| All Star | 4 | 2 | 50% | 20% |
| Vision-Tech | 7 | 1 | 14% | 20% |
| Seamless | 17 | 6 | 35% | 0% |
| Volcanoes | 4 | 0 | 0% | 67% |
| **合计** | **43** | **10** | **23.3%** | **32%（8/25）** |

另有 15 项无法判断：没有对应规则、没有 target，或者内容未检查。确认的漏报为 0，因为营业时间冲突等问题还没有对应规则，脚本不计入漏报。

## 误报按原因分组（10 条）
| 原因 | 条数 | 站点 | 建议修复 |
|---|---|---|---|
| WordPress 登录页的 noindex 和重复标题被当成问题 | 5 | Seamless | P1-07 补充：采样排除 `wp-login.php`、`/wp-admin/`、`?action=` |
| “near me” 的自然结果没有本地化（Napa、Idaho、Sioux Falls 等），却据此报“没看到客户域名” | 3 | PR、All Star、Seamless | 新增：自然结果多数不在目标市场时，记为 not_checked（sample_not_local） |
| 名称对齐太严：城市后缀（All Star Plumbing / …Fresno）、连字符和 LTD（Vision-Tech AV / Vision Tech AV LTD） | 2 | All Star、Vision-Tech | 新增：名称归一化去掉公司后缀、标点、城市名后再比较 |

## 需要负责人决定的 6 件事（影响基线数字）
1. **near me 的 3 条按误报算吗？** 草稿算误报：事实成立，但样本不在本地，结论没有意义。如果改成“正确”，误报率降到 7/43 ≈ 16%。
2. **名称差一个城市后缀或 LTD，算误报吗？** 草稿算误报。如果你认为应该提醒客户统一名称，改为正确。
3. **经营模式。** 系统输入把 PR、Vision-Tech、Volcanoes 都写成 storefront，草稿分别判为 hybrid、service_area、集合点。系统现在没有“集合点”这个选项。这部分直接关系到 P1-05。
4. **营业时间冲突，算漏报吗？** All Star 网站写 24 小时、GBP 写周一到周五 7–7；Vision-Tech 网站写工作日 9–17:30、GBP 写 24 小时。草稿记为应该报告，但系统还没有营业时间对齐规则，所以暂不计分。
5. **Volcanoes 的“5.0 Google Rating”链接**：草稿实时跳转后，终点是搜索“Volcanoes Hiking Guides”，和反馈的“指向国家公园”不一致，所以填 null。请你在浏览器里点一次，确认最后落在哪里。
6. **只看首页的字段**：PR、Seamless、Volcanoes 的“营业时间不存在”只依据首页静态 HTML。如果联系页上有，需要改回 null。

## 其他发现（不计入指标，转后续任务）
- Vision-Tech 有 3 个页面还写着旧地址 SA18 1NE Ammanford。Seamless 页面上有两个不同的地址。Nova 的隐私政策页写的是另一家公司。目前都没有规则覆盖。
- 页面类型分类有误：All Star 的 22 个服务页被判成 faq，terms-of-use 被判成 service_detail；Nova 的服务页被判成 other。转 P1-03。
- `service_title_review` 发现在 evaluation_catalog 里没有 target，永远无法计分（Nova、All Star 各 1 条）。这是工具缺口。
- `tests/test_p0_08_gold.py` 中有 4 项断言假定 truth 为空，填写答案后失败。这是预期结果，交给 Codex 改成“空模板夹具 + 真实答案”两套断言。

## 下一步
负责人回复以上 6 件事后，我按决定修改 truth.json，再请 Codex 更新测试并提交。确认后的数字作为 P1 的对比基线。

## 负责人决定（2026-11-04，第 1 轮）
1. “near me”的 3 条：**算误报**。理由：保存的样本不一定是目标市场 near me 搜索的真实自然结果。草稿已按此标注，无需改动。
2. 名称只差城市后缀、标点或 LTD：**算误报**。名称只要语义一致即可，不要求完全相同。草稿已按此标注。Seamless 的两个名称是真正不同的名字（“Seamless Gutters of Pensacola” 和 “Gutter Solutions & Home Improvements”），仍判正确。
3. 经营模式：**同意草稿**，PR 为 hybrid，Vision-Tech 为 service_area，Volcanoes 为集合点。→ P1-05 增加“集合点”模式，并修正 storefront 的默认推断。
4. 营业时间冲突：**应该报告**。草稿已记为应触发，但目前没有规则，所以不计分。→ P1 新增营业时间对齐规则，规则上线后这两条计入漏报。
5、6：负责人下一轮回复。

第 1–4 条与草稿一致，基线数字不变：误报率 10/43 ≈ 23%。

## 负责人决定（2026-11-04，第 2 轮）
5. Volcanoes“5.0 Google Rating”：负责人实际点击确认，落地页是本商家的 Google 结果，**没有指向国家公园**。truth 中 `rating-link-destination` 改为不应触发，`belongs_to_business` 改为 true。
6. 营业时间：PR 联系页确认没有营业时间（present=false）。Volcanoes 联系页有营业时间（present=true，但联系页不在保存的证据里，具体文字未记录）。Seamless 联系页暂时打不开，改为 null（未知）。

## 确认后的基线（2026-11-04，作为 P1 的对比基准）
- **误报率 10/43 ≈ 23.3%**（可判定发现 43 条，误报 10 条，漏报 0 条，无法判断 15 项）。
- **字段未检查率 9/26 ≈ 34.6%**：其中 `semantic_rules_not_implemented` 4 项（营业时间没有规则），`site_content_not_checked` 5 项（PR 3 项，Volcanoes 2 项）。
- 误报的 3 类原因及对应修复，见上文“误报按原因分组”。
- 采集覆盖不足：Volcanoes 只保存了首页，其营业时间存在于联系页，但系统没有采集到。→ P1：小站至少要采集联系页。

truth.json 的 `reviewed_by` 已标为“负责人已确认口径”。下一步：由 Codex 更新 `test_p0_08_gold.py`，把“空模板”断言和“真实答案”断言分开，然后提交。

## 测试更新与提交验证（2026-11-04，Codex）

- `tests/test_p0_08_gold.py` 的空白答案工厂改为测试内独立模板，缺输入用例也使用该模板，不再借用真实站点的已确认答案。六站离线测试分别运行空白和确认答案两组：空白组保留“未标注、分母为零时指标为 null”的断言；确认组固定误报数/分母为 10/43，字段未检查数/分母为 9/26。
- 六个 `truth.json` 未编辑；测试与全量评估后，SHA-256 与本轮开工时的负责人确认版本全部一致。
- 未改评估脚本或生产逻辑；本轮评估输出保存在临时目录，未覆盖先前冻结的评估产物。

在 `SearchTrust-RD` 实际执行：

```text
$ .venv/bin/python -m pytest -q tests/test_p0_*.py
237 passed in 43.47s

$ .venv/bin/python scripts/eval_gold.py > /tmp/p009-confirmed-eval.json
退出码：0
```

全量 JSON 的实际结果摘录：

```json
{
  "cases": 6,
  "external_calls": 0,
  "errors": [],
  "incomplete": false,
  "finding_metrics": {
    "false_positives": 10,
    "judged_generated_findings": 43,
    "false_negatives": 0,
    "false_positive_rate": 0.23255813953488372
  },
  "field_metrics": {
    "confirmed_present_fields": 26,
    "not_checked_fields": 9,
    "not_checked_rate": 0.34615384615384615,
    "not_checked_by_reason": {
      "semantic_rules_not_implemented": 4,
      "site_content_not_checked": 5
    }
  }
}
```

六站状态均为“已生成”。没有新增外部调用或费用，未 push、未部署。
