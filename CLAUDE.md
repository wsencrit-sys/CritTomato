# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Crit Tomato 是一个基于 Tauri v2 的桌面小组件，整合了**时钟**、**多时区显示**和**番茄钟**功能。窗口默认 320×520，支持切换为迷你模式（220×76-140）的透明悬浮窗。

## 技术栈

- **前端**：原生 JavaScript (ES modules)，无框架，Vite 6 打包
- **后端**：Rust / Tauri v2，提供原生窗口管理、系统托盘和通知
- **样式**：纯 CSS（CSS 自定义属性），深色主题，番茄红为主色调
- **国际化**：自建 i18n 模块，支持 en / zh-CN

## 常用命令

```bash
# 前端开发（仅 Vite，不含 Tauri）
npm run dev          # 启动 Vite 开发服务器，端口 1420
npm run build        # 构建前端到 dist/

# Tauri 开发与构建
cargo tauri dev      # Tauri 开发模式（自动启动 Vite + Rust）
cargo tauri build    # 生产构建
```

## 架构

```
src/
├── index.html          # 入口 HTML，定义整体布局结构
├── js/
│   ├── app.js          # App 入口 — 编排各模块、迷你模式切换、窗口控制（置顶/最小化）
│   ├── clock.js        # Clock — 本地时钟，每秒刷新，支持 12/24 小时切换
│   ├── timezone.js     # TimezoneManager — 多时区列表，模态框添加/删除，localStorage 持久化
│   ├── pomodoro.js     # Pomodoro — 状态机（idle→running→paused→break），SVG 圆环进度，Web Audio 提示音，Tauri 通知
│   └── i18n.js         # i18n — t(key, vars) 翻译查找，data-i18n DOM 绑定，语言检测（localStorage → navigator）
└── styles/
    └── main.css        # 全部样式，包括迷你模式和模态框

src-tauri/
├── Cargo.toml          # Rust 依赖（tauri 2 + tray-icon feature, tauri-plugin-notification）
├── tauri.conf.json     # Tauri 配置 — 无边框窗口、透明背景、始终置顶、320×520、Vite 集成
├── build.rs            # Tauri 构建脚本
└── src/
    ├── main.rs         # Rust 入口 — 调用 lib::run()
    └── lib.rs          # Tauri 应用核心 — 系统托盘（程序化番茄图标）、中文本地化检测、关闭到托盘
```

## 关键设计决策

### 双模式 (Normal / Mini)
- `App` 类控制两种模式切换，通过 `window.setSize()` 调整窗口大小
- 迷你模式下透明背景，通过 CSS `body.mini-mode` 控制显示，仅显示时钟（+ 番茄钟仅在 running/paused 状态时可见）
- 迷你模式下 `pointer-events: none` 使背景穿透点击，仅按钮和文字可交互

### 番茄钟状态机
- `idle → running → paused → running → (complete) → break → idle`
- 状态变化通过 `CustomEvent('pomodoro-state')` 通知 App 更新迷你模式可见性
- 完成提示音使用 Web Audio API（双音调 beep），通知通过 `@tauri-apps/plugin-notification`

### 时区管理
- 预设 18 个常用 IANA 时区，通过 `Intl.DateTimeFormat` 格式化时间
- UTC 偏移量通过小时差计算（处理日界 wrap）
- 用户数据存储在 `localStorage` 的 `crit-tomato-timezones` 键

### Tauri 窗口行为
- 无边框（`decorations: false`）、透明（`transparent: true`）、始终置顶（`alwaysOnTop: true`）
- 标题栏 `data-tauri-drag-region` 允许拖拽移动窗口
- 关闭按钮隐藏窗口到托盘而非退出，系统托盘左键点击切换显示/隐藏
- 系统托盘菜单文字根据 Windows 系统语言环境自动选择中/英文
