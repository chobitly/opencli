# ChatGPT Desktop Adapter for OpenCLI

Control the **ChatGPT macOS Desktop App** directly from the terminal via native AppleScript automation. Unlike Electron-based apps (Antigravity, Codex, Cursor), ChatGPT Desktop is a native macOS application — OpenCLI drives it using `osascript` and System Events.

## Prerequisites

1. Install the official [ChatGPT Desktop App](https://openai.com/chatgpt/mac/) from OpenAI.
2. Grant **Accessibility permissions** to your terminal app (Terminal / iTerm / Warp) in **System Settings → Privacy & Security → Accessibility**. This is required for System Events keystroke simulation.

## Setup

No extra environment variables needed — the adapter uses `osascript` directly.

## Commands

### Diagnostics
- `opencli chatgpt status`: Check if the ChatGPT app is currently running.

### Chat Manipulation
- `opencli chatgpt new`: Activate ChatGPT and press `Cmd+N` to start a new conversation.
- `opencli chatgpt send "message"`: Copy your message to clipboard, activate ChatGPT, paste, and submit.
- `opencli chatgpt read`: Copy the last AI response via `Cmd+Shift+C` and return it as text.

## How It Works

Unlike CDP-based adapters, this adapter:
- Uses `osascript` to send AppleScript commands to System Events
- Leverages `pbcopy`/`pbpaste` for clipboard-based text transfer
- Requires no remote debugging port — works with the stock app

## Limitations

- macOS only (AppleScript dependency)
- Requires Accessibility permissions for keystroke simulation
- `read` command copies the last response — earlier messages need manual scroll
