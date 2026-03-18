# ChatGPT 桌面端适配器

通过原生 AppleScript 自动化，在终端中直接控制 **ChatGPT macOS 桌面应用**。与基于 Electron 的应用（Antigravity、Codex、Cursor）不同，ChatGPT Desktop 是原生 macOS 应用 — OpenCLI 使用 `osascript` 和 System Events 来驱动它。

## 前置条件

1. 安装官方 [ChatGPT Desktop App](https://openai.com/chatgpt/mac/)。
2. 在 **系统设置 → 隐私与安全性 → 辅助功能** 中为终端应用（Terminal / iTerm / Warp）授予 **辅助功能权限**。这是 System Events 按键模拟所必需的。

## 配置

无需额外环境变量 — 适配器直接使用 `osascript`。

## 命令

### 诊断
- `opencli chatgpt status`：检查 ChatGPT 应用是否在运行。

### 对话操作
- `opencli chatgpt new`：激活 ChatGPT 并按 `Cmd+N` 开始新对话。
- `opencli chatgpt send "消息"`：将消息复制到剪贴板，激活 ChatGPT，粘贴并提交。
- `opencli chatgpt read`：通过 `Cmd+Shift+C` 复制最后一条 AI 回复并返回文本。

## 工作原理

与基于 CDP 的适配器不同，此适配器：
- 使用 `osascript` 向 System Events 发送 AppleScript 命令
- 利用 `pbcopy`/`pbpaste` 进行基于剪贴板的文本传输
- 无需远程调试端口 — 直接与原生应用交互

## 限制

- 仅支持 macOS（AppleScript 依赖）
- 需要辅助功能权限以模拟按键
- `read` 命令复制最后一条回复 — 更早的消息需要手动滚动
