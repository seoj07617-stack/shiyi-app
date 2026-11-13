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

## 历史

1. **浅色编辑风 + 克制紫**：画布 `#F1F1F3`、实心白卡、36–40px 圆角、Newsreader / Inter、紫 `#8B75B8`。已停用。
2. **Caffeine Day 近黑**（2026-11-13 上午）：`#070707` 画布、`#0E0E0E` 工作区、发丝内描边。同日下午被浅色玻璃替换。
