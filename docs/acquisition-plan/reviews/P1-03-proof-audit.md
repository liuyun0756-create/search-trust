# P1-03 十站证明元素离线核对（2026-11-17）

数据：6站金标准原输入，以及第六次冒烟49c74362的客户及三家竞品。未修改truth、已冻结输入或checksum。此表是实施者逐条核对保存HTML/文本后的规则检查，不代替负责人金标准标注，也不是全站准确率。

`—`均为not_checked/null，绝不是0或不存在。数字是去重后的正向声明/展示区下限，不是项目数、有效证书数或全站总数。两份PR来自不同时间及采样范围，按独立样本列出。

| 站点 | 目标城市 | 城市 | 详细案例 | 展示区 | 资质声明 | 价格信息 | 优惠 | 项目预算 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| all-star-plumbing-fresno | Fresno | 1 | — | — | 4 | — | — | — |
| nova-service | Fresno | 1 | — | — | — | — | — | — |
| pr-plumbing-fresno | Fresno | 1 | 1 | 6 | 5 | — | — | 1 |
| seamless-gutters-pensacola | Pensacola | 1 | — | — | — | 1 | — | — |
| vision-tech-swansea | Swansea | 1 | — | 1 | 10 | — | — | — |
| volcanoes-hiking-guides | Hilo | — | — | — | — | — | — | — |
| Fresno Plumbing & Heating Inc | Fresno | 1 | — | — | 3 | — | — | — |
| PR Plumbing, Heating & Air Conditioning Inc. | Fresno | 1 | 1 | 6 | 1 | — | — | 1 |
| Art Douglas Plumbing Inc | Fresno | 1 | — | — | 6 | — | 5 | — |
| Low Cost Plumbing Services | Fresno | 1 | — | — | 1 | — | — | — |

## 每一类的命中核对

| 类别 | 命中/逐条核对数 | 原文与判定 | 最终误命中 |
|---|---:|---|---|
| 目标城市 | 9/9 | 标题/正文/页脚确有Fresno、Pensacola或Swansea；Fresno Plumbing品牌名中的Fresno单独排除，首页另有`Fresno, CA`。 | 0 |
| 详细案例 | 2/2 | 两份PR均为同一Ferdi tub叙述：installed/customer/location/project completed，含具体工作及至少两种细节。索引和详情重复不再算2个。 | 0 |
| 展示区 | 13/13 | 两份PR各6个Recent/Latest Projects、Additional Projects或Image Gallery内容区；Vision的1个Photo Gallery。多个展示区不等于不同项目。 | 0 |
| 资质声明 | 30/30 | All Star4、PR金标准5、Vision10、Fresno3、PR竞品1、Art6、Low Cost1。均有本商家/工程师的明确声明或执照号码；只确认页面如此宣称，不核验证书。 | 0 |
| 价格信息 | 1/1 | Seamless成本指南`$7.50 to $10 per linear foot`，归“Service pricing information”，不是商家承诺报价。 | 0 |
| 优惠 | 5/5 | Art首页$5/$35/$100/$15/$40 OFF；重复轮播和大小写/标点变体去重；不混入服务价格。 | 0 |
| 项目预算 | 2/2 | 两份PR同一具体案例的`Estimated budget: $2,000`；与服务价格分开。 | 0 |

合计：53条证明元素+9条目标城市命中，均逐条查看溯源URL及原文。最终“0误命中”仅针对本表已命中的原文符合规则，不能外推为召回完整或报告全局误报率。

## 核对中收窄及未覆盖项

- 初版将All Star的一般项目宣传、Vision的project management等当展示区：收窄为明确作品标题+同容器图片/项目链接后，前者1→未检查，Vision22→1。
- Vision的硬件/设计文件认证不等于商家资质：本商家主体要求后13→10。
- PR案例索引与详情重复2→1；Art重复优惠8→5。
- Fresno冻结HTML里有项目内容、Low Cost有Our Works，不代表当前严格DOM规则必然命中；本轮两者的展示区仍未检查，不称“没有案例”。Volcanoes无命中亦未检查；不通过补采或图片猜测填值。
- 单页HTML沿用1MB/20,000节点/深度64的解析资源边界，超限保留未知；前缀结构不合格与已保存深采正证据分别处理。
- 离线provider mock为0；输入及来源payload字节不变。提取规则详见设计确认，截图和逐条完整原文仅保存在本地output/私有目录，不提交客户原始输入。
