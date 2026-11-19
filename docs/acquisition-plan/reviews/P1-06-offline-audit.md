# P1-06 冻结样本预审计

设计阶段在本地扫描冻结的六站与第六次冒烟 49c74362 的客户站及三个竞品站。来源仅限绑定的成功 HTML 深度页，原校验和保留。provider 和 socket 拦截均为 0。以下为设计规则离线试跑及原文人工核对记录，功能验收留待实现。

| 样本 | 已解析 / 选中 | 评分 | 奖项 | 资质 | 平台 | 本商家 / 他方 / 未检查 | 误命中 |
|---|---:|---:|---:|---:|---:|---:|---:|
| All Star | 25 / 25 | 0 | 0 | 4 | 2 | 0 / 0 / 6 | 0 |
| Nova | 13 / 13 | 0 | 0 | 0 | 0 | 0 / 0 / 0 | 0 |
| PR（金标准） | 50 / 50 | 0 | 0 | 5 | 0 | 0 / 0 / 5 | 0 |
| Seamless | 49 / 50 | 0 | 0 | 0 | 0 | 0 / 0 / 0 | 0 |
| Vision-Tech | 50 / 50 | 1 | 0 | 10 | 0 | 0 / 0 / 11 | 0 |
| Volcanoes | 0 / 1 | 0 | 0 | 0 | 0 | 0 / 0 / 0 | 0 |
| Fresno（49c 客户） | 16 / 16 | 0 | 0 | 3 | 0 | 0 / 0 / 3 | 0 |
| PR（49c 竞品） | 10 / 10 | 0 | 0 | 1 | 0 | 0 / 0 / 1 | 0 |
| Art Douglas（49c 竞品） | 10 / 10 | 0 | 0 | 6 | 1 | 0 / 0 / 7 | 0 |
| Low Cost（49c 竞品） | 1 / 1 | 0 | 0 | 1 | 0 | 0 / 0 / 1 | 0 |
| **总计** | **224 / 226** | **1** | **0** | **30** | **3** | **0 / 0 / 34** | **0** |

逐项人工核对显示，命中内容属于对应声明类型。误命中计数只评估命中结果。奖项与他方实体分支需用独立夹具覆盖。All Star 的两个 Yelp 锚点指向同一 profile，带追踪参数的原链接与标准链接都列在证据清单。它们是两个锚点，只有一个候选目标实体。Art Douglas 的 BBB 链接同样没有已确认的 BBB ID 可比。未检查来自缺链接、非可核验声明或没有同平台已确认身份键。执照号码是页面自述。

Volcanoes 的绑定网站来源只有一个结构截断的首页记录，deep_analyzed=false、deep_snapshot=null、internal_links=[]。离线单独查看的未绑定 page.html 有 3 个同文同目标锚点，文本为 “5.0 Google Rating”，链接为 https://share.google/tv7K3sxM5ATPwNgxu，去重后为 1。URL 本身没有 CID、Place ID 或 Data ID。负责人确认跳转后属于本商家，但已绑定输入只保存确认的 Google GBP CID 16906567364961418758，没有该徽章的链接与跳转证据。该页在主表中无可检查声明。

## 人工核对清单

逐行列出保存的页面、短摘录、原链接及未检查依据。资质摘录来自 P1-03 的实际抽取。

| 样本 / 页面 | 类型 | 原文摘录 | 链接 | 人工核对 |
|---|---|---|---|---|
| All Star [/](https://allstarplumbingfresno.com/) | 平台 | yelp | [yelp.com](https://yelp.com/biz/all-star-plumbing-fresno) | 平台徽章，缺已确认平台键 |
| All Star [/](https://allstarplumbingfresno.com/) | 平台 | Check out All Star Plumbing on Yelp | [yelp.com](https://yelp.com/biz/all-star-plumbing-fresno?utm_medium=badge_reviews&utm_source=biz_review_badge) | 平台徽章，缺已确认平台键 |
| All Star [/faucet-installation](https://allstarplumbingfresno.com/faucet-installation) | 资质 | se to get the job done right. Our licensed plumbers can repair all types of faucets including compression, ball, disc, and cartridge models. If your fa | — | 商家自述，未核验 |
| All Star [/garbage-disposal-installation](https://allstarplumbingfresno.com/garbage-disposal-installation) | 资质 | sting disposal working again, our licensed technicians have you covered. | — | 商家自述，未核验 |
| All Star [/tankless-water-heaters](https://allstarplumbingfresno.com/tankless-water-heaters) | 资质 | ng an existing tankless unit, our licensed technicians ensure a safe and proper installation. | — | 商家自述，未核验 |
| All Star [/water-heater-installation](https://allstarplumbingfresno.com/water-heater-installation) | 资质 | from all major manufacturers. Our licensed technicians ensure proper sizing, safe gas and electrical connections, and code-compliant venting to keep your | — | 商家自述，未核验 |
| PR（金标准） [/](https://www.prplumbingfresno.com/) | 资质 | Our certified technicians are expertly skilled in heating and air conditioning repair services. We can identify maintenance a | — | 商家自述，未核验 |
| PR（金标准） [/air-conditioning-services](https://www.prplumbingfresno.com/air-conditioning-services) | 资质 | We have certified technicians for all Fresno air conditioning needs such as air conditioners, air conditioning instal | — | 商家自述，未核验 |
| PR（金标准） [/commercial-services](https://www.prplumbingfresno.com/commercial-services) | 资质 | We have certified technicians for all HVAC & commercial refrigeration in Fresno whether your needs are furnaces, mech | — | 商家自述，未核验 |
| PR（金标准） [/heating-repairs](https://www.prplumbingfresno.com/heating-repairs) | 资质 | Our team of certified heating technician's will provide professional heating repairs in Fresno & surrounding areas for an | — | 商家自述，未核验 |
| PR（金标准） [/plumbing-and-hvac-tips/water-heater-repair-fresno-why-is-my-water-heater-making-knocking-noises](https://www.prplumbingfresno.com/plumbing-and-hvac-tips/water-heater-repair-fresno-why-is-my-water-heater-making-knocking-noises) | 资质 | to schedule service now, and our licensed technicians will get your system back on track. | — | 商家自述，未核验 |
| Vision-Tech [/services](https://visiontechav.com/services) | 资质 | Our certified engineers manage full-stack hardware integration, performing rigorous validation and stress-testing. We ensur | — | 商家自述，未核验 |
| Vision-Tech [/services/av-installation-commissioning](https://visiontechav.com/services/av-installation-commissioning) | 资质 | nce operational environments. Our certified engineers manage every detail of the physical deployment, performing rigorous validation to guarantee optimal | — | 商家自述，未核验 |
| Vision-Tech [/about-us](https://visiontechav.com/about-us) | 资质 | Our team consists of certified AV engineers, CAD designers, and project managers. We stay at the forefront of the industry with co | — | 商家自述，未核验 |
| Vision-Tech [/about-us](https://visiontechav.com/about-us) | 评分 | 4.9/5 Trust Score Rated | — | 评分声明，无链接 |
| Vision-Tech [/solutions/av-for-education](https://visiontechav.com/solutions/av-for-education) | 资质 | Our certified engineers manage the physical deployment with minimal disruption to the academic calendar. We integrate inter | — | 商家自述，未核验 |
| Vision-Tech [/solutions/av-solutions-for-culture-leisure](https://visiontechav.com/solutions/av-solutions-for-culture-leisure) | 资质 | Our certified engineers design and deliver bespoke AV systems supported by detailed site surveys, acoustic planning, and pr | — | 商家自述，未核验 |
| Vision-Tech [/solutions/digital-signage](https://visiontechav.com/solutions/digital-signage) | 资质 | "Our certified engineers manage the estate-wide deployment with minimal disruption. We integrate professional-grade SoC disp | — | 商家自述，未核验 |
| Vision-Tech [/solutions/meeting-room-av-systems](https://visiontechav.com/solutions/meeting-room-av-systems) | 资质 | Our certified engineers manage the physical deployment with minimal disruption. We integrate high-definition optics, beamfo | — | 商家自述，未核验 |
| Vision-Tech [/solutions/meeting-room-av-systems/boardroom-av-systems](https://visiontechav.com/solutions/meeting-room-av-systems/boardroom-av-systems) | 资质 | Our certified engineers handle the physical deployment with minimal disruption to your business. We integrate high-definiti | — | 商家自述，未核验 |
| Vision-Tech [/solutions/wireless-display-solutions](https://visiontechav.com/solutions/wireless-display-solutions) | 资质 | Our certified engineers manage the estate-wide deployment with minimal disruption. We integrate high-spec hardware, configu | — | 商家自述，未核验 |
| Vision-Tech [/planned-preventative-maintenance](https://visiontechav.com/planned-preventative-maintenance) | 资质 | Surgical Technical Oversight: Our certified engineers identify "at- risk" components during scheduled visits, allowing for planned replacements rather th | — | 商家自述，未核验 |
| Fresno（49c 客户） [/](https://www.fresnoplumbinginc.com/) | 资质 | ons that protect us all. Yes, we are medical gas certified. | — | 商家自述，未核验 |
| Fresno（49c 客户） [/](https://www.fresnoplumbinginc.com/) | 资质 | Did we mention that we are certified to install residential fire sprinkler systems? We've done thousands of them. | — | 商家自述，未核验 |
| Fresno（49c 客户） [/](https://www.fresnoplumbinginc.com/) | 资质 | (559) 294-0300 ​ Contractors License#424352 DIR #1000000516 Privacy Policy | — | 商家自述，未核验 |
| PR（49c 竞品） [/](https://www.prplumbingfresno.com/) | 资质 | Our certified technicians are expertly skilled in heating and air conditioning repair services. We can identify maintenance a | — | 商家自述，未核验 |
| Art Douglas（49c 竞品） [/](https://www.artdouglasplumbing.com/) | 资质 | WE ARE FULLY LICENSED, SCREENED AND TRAINED | — | 商家自述，未核验 |
| Art Douglas（49c 竞品） [/](https://www.artdouglasplumbing.com/) | 资质 | vices from the best plumbers. We are licensed and insured for your protection, and we perform full background checks on everyone on our team including drivin | — | 商家自述，未核验 |
| Art Douglas（49c 竞品） [/](https://www.artdouglasplumbing.com/) | 资质 | CSLB License #699348 | — | 商家自述，未核验 |
| Art Douglas（49c 竞品） [/](https://www.artdouglasplumbing.com/) | 平台 | Art Douglas Plumbing, Heating & Air Conditioning BBB Business Review | [www.bbb.org](https://www.bbb.org/us/ca/fresno/profile/plumber/art-douglas-plumbing-heating-air-conditioning-1066-8000564/#sealclick) | 平台徽章，缺已确认平台键 |
| Art Douglas（49c 竞品） [/plumbing-services](https://www.artdouglasplumbing.com/plumbing-services) | 资质 | ction, or an in-depth repair, our licensed team has you covered. Art Douglas Plumbing has served Fresno County since 1971 and continues to offer a | — | 商家自述，未核验 |
| Art Douglas（49c 竞品） [/about-us](https://www.artdouglasplumbing.com/about-us) | 资质 | and standing behind our work. Our team is licensed, experienced, and committed to delivering plumbing solutions that protect your home or business wit | — | 商家自述，未核验 |
| Art Douglas（49c 竞品） [/toilets](https://www.artdouglasplumbing.com/toilets) | 资质 | ng, please call us today, and our licensed technicians will get to the bottom of the issue. A reliable repair will protect your home or property from dama | — | 商家自述，未核验 |
| Low Cost（49c 竞品） [/](https://www.low-costplumbingservices.com/) | 资质 | License # #1028276 | — | 商家自述，未核验 |
