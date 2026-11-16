# 浅色 + 毛玻璃（当前视觉）

> 2026-11-13 下午起，工作台视觉以本文为准：**浅色画布 + 毛玻璃**。
> 同日上午短暂上线的 Caffeine Day 近黑底（`#070707` / `#0E0E0E`）按君的意见已纠正，不再作为页面主色。
> 更早的「浅色编辑风 + 克制紫」只留作历史说明，见 `theme-shiyi-purple.md`。实际令牌以 `assets/command.css` 的 `:root` 为准。

## 底

画布是浅暖灰 `#F4F2EE`，上面压一层极淡的蓝雾与暖沙渐变给玻璃当背景；不刺眼死白，也不回到纯黑。卡片里子接近 `#FFFEFB`，半透明铺在画布上。

## 玻璃

卡片、悬浮底栏（Dock）、顶栏、侧栏、GIF 浮层都走毛玻璃：`backdrop-filter: blur(20px) saturate(160%)`（同时写 `-webkit-` 前缀），填充 `rgba(255,255,255,0.62)`，`rgba(255,255,255,0.7)` 的浅色高光边加一层极淡外描边，再配一层轻的层叠阴影，让玻璃浮在底上。不做实心白块，也不做深色玻璃。

不支持 `backdrop-filter` 的旧浏览器、以及开了 `prefers-reduced-transparency: reduce` 的环境，回退成不透明的 `#FFFEFB` 浅色卡片。

## 保留的 Caffeine 克制

- 唯一强调色 `#3B82F6`：焦点、当前项、少数关键数字。旧克制紫 `#8B75B8` 不作为主强调。
- 卡片圆角 20px（`--r-card`），芯片 / 胶囊 100px（`--r-chip`），小方块 12px（`--r-tile`）。
- 等宽数字与克制的系统字体：`ui-monospace` + 苹方 `PingFang SC` / `Noto Sans SC`；不引入 Google Fonts（Inter / Newsreader / Noto Serif 都不加）。
- 动效仍用 `cubic-bezier(0.32, 0.72, 0, 1)`，并尊重 `prefers-reduced-motion`。

## 字

主文字 `#171717`，正文 `#1A1A1A`，次要说明 `#5C5C5C`，最弱的标签 `#6B6B6B`。浅底上八个 Tab（今日、健康、学习、新闻、开源、飞书、拍板、地图）都要能直接读，不靠深色底衬。

### 字号与控件（2026-11-16 细化）

目标「更细、更清楚」，不是「更小」。字号阶收在 `:root` 的 `--text-body` / `--text-secondary` / `--text-meta` / `--text-kicker` / `--text-title` / `--text-h2` / `--text-h1` / `--text-display`：正文 13px、次行 12px、元信息 11px，可读中文不低于 11px；标题约 24 / 20 / 16px（桌面主标题 28px）。字重 400 正文、500 标签、600 标题与当前项，层级先靠字重和 `--strong` / `--ink` / `--mid` / `--dim` 的灰阶，再靠字号。正文与普通标题字距为 0，大数字与大标题略收到 `-0.02em`。可点控件统一约 32px 高、12–13px 字。

字号与控件借鉴 Twenty / Radix Themes / coss ui 的规则，字体仍为系统栈；Bonjourr 仅借鉴字距思路，未复制其源码。

## 图表库（2026-11-16）

三套开源图表库的官方预构建文件放 `assets/vendor/`（许可证文本随附同目录）：Apache ECharts 5.6.0（Apache-2.0，simple 精简构建）、Chart.js 4.4.7（MIT，官方 umd）、uPlot 1.6.32（MIT，官方 dist）。按页懒加载：进页才加载脚本、离开页面即销毁实例，boot 不预挂任何一套；无数据不出空图。图表配色只走 `#3B82F6` 与灰阶，不引入第二强调色。

## 历史

1. **浅色编辑风 + 克制紫**：画布 `#F1F1F3`、实心白卡、36–40px 圆角、Newsreader / Inter、紫 `#8B75B8`。已停用。
2. **Caffeine Day 近黑**（2026-11-13 上午）：`#070707` 画布、`#0E0E0E` 工作区、发丝内描边。同日下午被浅色玻璃替换。
