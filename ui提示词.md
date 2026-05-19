# SearchTrust UI 设计风格规范

## 整体风格

现代 B2B SaaS，克制、高级、偏暗色调。浅色区块与深色区块交替使用，打破长页面单调感。

## 色彩体系

### 核心色板

| 角色 | 色值 | 用途 |
|------|------|------|
| 品牌主色 | `#A5D020` | 图标、勾选、标签、角标等点缀，不铺大面 |
| 深色背景 | `#0B0C0E` / `#1A1F2B` | 深色区块背景（接近纯黑，带微蓝调） |
| 浅色背景 | `#F9FAFB` / `#F8F9FA` | 浅色区块背景（非纯白，偏灰） |
| 卡片背景 | `#FFFFFF` / `#F8F9FA` | 白色卡片用白，内嵌卡片用浅灰 |
| 强调蓝 | `#3B82F6` | 辅助强调色（Input 标签、分割线、列表圆点） |
| 警告橙 | `#F97316` / `#FFF7ED` | Trust Status 等警示区块 |

### 文字色阶

| 层级 | 色值 | 用途 |
|------|------|------|
| 主文字 | `#1A1F2B` | 标题、按钮文字 |
| 正文 | `#6B7280` | 段落、描述、列表 |
| 弱文字 | `#9CA3AF` | 辅助说明、注释 |
| 深色区块白 | `#FFFFFF` / `#E5E7EB` | 深色背景上的文字 |

## 排版规范

### 字号

| 元素 | 大小 | 字重 | 行高 |
|------|------|------|------|
| 大标题 H2 | `36px`–`48px` | `bold (700)` | `1.1`–`1.2` 紧凑 |
| 卡片标题 H3 | `18px`–`22px` | `bold (700)` | `1.3` `snug` |
| 正文 | `14px`–`16px` | `medium (500)` | `relaxed` |
| 标签/角标 | `10px`–`12px` | `bold` | — |
| 导航 | `14px` | `bold` | — |

### 特殊排版

- 小标签：`10-12px` + `uppercase` + `tracking-[0.15em]~[0.2em]`
- 标题中强调文字用品牌色 `text-[#A5D020]`
- 引用/来源说明用 `italic` + `border-l` 装饰

## 卡片规范

- 圆角：`rounded-[24px]`（标准卡片）/ `rounded-[32px]`（大号 CTA 卡片）/ `rounded-xl`（内部小组件）
- 阴影：极浅 `shadow-[0_4px_20px_rgba(0,0,0,0.03)]` / `shadow-[0_10px_40px_rgba(0,0,0,0.04)]`
- 边框：`border border-gray-100` 极细线
- 悬浮：`hover:shadow-lg` 或 `hover:bg-gray-50/50`，克制不夸张

### 深色区块卡片（Glassmorphism）

```
bg-white/5 backdrop-blur-md border border-white/10
```

- 半透明 + 模糊 + 极细白边
- 阴影加深：`shadow-[0_30px_60px_rgba(0,0,0,0.15)]`

## 布局规范

### 容器

- 统一最大宽度：`container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8`
- 内容限制：`max-w-5xl` / `max-w-6xl` / `max-w-3xl`（按区块内容密度选择）

### 间距

| 场景 | 值 |
|------|------|
| 区块上下内边距 | `py-20` |
| 标题与内容间距 | `mb-16` / `mb-20` |
| 卡片内边距 | `p-10` / `md:p-14` |
| 卡片网格间距 | `gap-6` / `gap-8` |
| 列表项间距 | `space-y-5` / `space-y-4` |

### 网格

- 2x2 布局：`grid grid-cols-1 md:grid-cols-2`
- 3 列布局：`grid grid-cols-1 md:grid-cols-3`
- 4 列布局：`grid grid-cols-1 md:grid-cols-4`
- 12 列栅格：`grid grid-cols-1 lg:grid-cols-12`（用于左右不对称布局如 FAQ）
- VS 对比布局：`flex md:flex-row items-stretch` + 右侧 `md:-ml-12` 重叠

## 交互与动效

### 导航动效

- framer-motion `layoutId` 实现 Tab 切换滑动背景
- 弹簧动画：`type: "spring", bounce: 0, duration: 0.4`
- Tab 背景：`bg-[#E7EDF2] rounded-[8px]`

### 悬浮效果

- 卡片 hover：`hover:shadow-lg` + `transition-shadow duration-300`
- 按钮 hover：`hover:bg-black` / `hover:bg-gray-200` 色阶变化
- 文字链接 hover：`hover:text-[#A5D020]`
- 图标容器 hover：背景从 `primary/10` 变为 `primary`，图标变白

### 过渡时间

- 默认：`duration-200` ~ `duration-300`
- 手风琴展开：`duration-300 ease-in-out`

## 按钮规范

| 类型 | 样式 |
|------|------|
| 主按钮（深色） | `bg-[#1D2531] text-white rounded-full px-6 py-2.5 hover:bg-black` |
| 主按钮（白色） | `bg-white text-[#0B0C0E] rounded-xl px-8 py-4 hover:bg-gray-200` |
| 次要按钮 | `border border-white/20 text-white rounded-xl hover:bg-white/5` |
| 次要按钮（浅色） | `bg-white border border-[#D1D5DB] rounded-lg hover:bg-gray-50` |
| 品牌按钮 | `bg-[#A5D020] text-white` （仅用于角标、VS 圆圈等点缀） |

## 图标规范

- 库：Lucide React
- 大小：`16px`–`28px`，按场景选择
- 线宽：`strokeWidth={1.5}`（层级列表）/ 默认（其他）
- 品牌色：`text-[#A5D020]`
- 容器：`w-12 h-12 rounded-xl bg-white shadow border` 或 `w-10 h-10 rounded-lg bg-[color]`

## 装饰元素

- 背景光晕：`bg-[#A5D020]/10 blur-[80px] rounded-full` 柔和装饰
- 超大背景数字：`text-[48px] font-bold text-gray-50` select-none
- 分割线装饰：`w-6 h-[1px] bg-gray-400` + 斜体来源说明
- VS 圆圈：`w-16 h-16 rounded-full bg-[#A5D020] border-[6px] border-white shadow-[0_0_30px_rgba(165,208,32,0.4)]`

## 页面结构模板

```
<section className="py-20 bg-[#F9FAFB]">  ← 或 bg-white / bg-[#0B0C0E]
  <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

    {/* 标题区 */}
    <div className="text-center mb-16">
      <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B]">
        标题
      </h2>
    </div>

    {/* 内容区 */}
    ...

  </div>
</section>
```

## 可直接使用的主题风格提示词

```
Design a modern, professional B2B SaaS landing page with the following style:

- Theme: Light gray backgrounds (#F9FAFB) alternating with near-black sections (#0B0C0E)
- Primary accent: Muted lime green (#A5D020) — used sparingly for icons, badges, checkmarks, and small highlights only
- Secondary accent: Blue (#3B82F6) for links, dividers, list dots
- Background: Non-pure-white light gray (#F8F9FA), never pure white
- Typography: Sans-serif (Inter), bold headings (36-48px), medium body text (14-16px), compact line height (1.1-1.2)
- Cards: Large rounded corners (24px), ultra-subtle shadows, thin gray borders (#F8F9FA or white)
- Dark section cards: Glassmorphism — bg-white/5, backdrop-blur, border-white/10
- Buttons: Dark primary (bg-[#1D2531] rounded-full), white CTA (bg-white rounded-xl), never green buttons for main CTAs
- Layout: max-w-7xl container, py-20 sections, mb-16/mb-20 title spacing, grid layouts
- Effects: Framer Motion for nav tabs (spring animation), subtle hover shadows, smooth 300ms transitions
- Mood: Restrained, sophisticated, trustworthy, technical — not flashy or playful
- Spacing: Generous vertical padding, consistent margins, breathing room between elements
- Icons: Lucide line icons in brand green (#A5D020), contained in 12x12 rounded containers
```
