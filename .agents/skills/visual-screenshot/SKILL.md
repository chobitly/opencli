---
name: visual-screenshot
description: Skills for capturing high-quality full-page or viewport screenshots using CDP.
---

# Visual Screenshot Skill

> [!NOTE]
> **人眼快读 / Human Quick Guide**
> 
> ### 全能截图命令：`generic screenshot`
> - **视觉截图**：生成真正的 PNG/JPEG 图片，而非 HTML/DOM 快照。
> - **全屏支持**：使用 `--full` 参数自动滚动并截取完整网页。
> - **即时导航**：支持直接传入 URL，或对当前浏览器窗口直接截图。
> - **避免冲突**：使用 `--img-format` 指定图片格式（默认 png），避免与全局 `--format` 渲染参数混淆。
> ### 快速示例：
> - **截取当前窗口（长图）**：
>   - `opencli generic screenshot --full --output ./full.png`
> - **截取特定 URL**：
>   - `opencli generic screenshot https://github.com/jackwener/opencli --output ./opencli.png`
> - **指定 JPEG 质量**：
>   - `opencli generic screenshot --img-format jpeg --quality 80`
> ---
> **AI Agent Note**: Skip the section above and follow the technical specifications below.

## Core Capabilities

### 1. Visual Page Capture (`screenshot`)
The primary tool for visual auditing and archiving. It uses Chrome DevTools Protocol (CDP) to capture the rendered pixels of a page.

**Command:**
```bash
opencli generic screenshot [URL] [options]
```

**Arguments:**
- `[URL]`: (Optional) The URL to navigate to before taking the screenshot. If omitted, it captures the current active tab.

**Options:**
- `--full`: Capture the full scrollable page (beyond the viewport).
- `--output <path>`: File path to save the screenshot (default: `./screenshot.png`).
- `--width <number>`: Specify the viewport width (e.g., 1280, 750). Useful for mobile/responsive testing.
- `--img-format <png|jpeg>`: Output image format (default: `png`).
- `--quality <0-100>`: JPEG compression quality (only applies when `img-format` is `jpeg`).

---

## Technical Requirements & Best Practices

### 1. Resolution & Scrolling
- **Full Page**: When `--full` is used, the command automatically triggers `captureBeyondViewport` (Core) or temporary viewport resizing (Extension) to ensure the entire content is captured.
- **Lazy Loading**: For pages with heavy lazy-loading, it's recommended to use `opencli generic scroll down 2000` (if available) or `wait` commands before taking the screenshot to ensure all assets are loaded.

### 2. Output Management
- **Directory Creation**: The command automatically creates parent directories if the `--output` path doesn't exist.
- **Format Conflict**: Always use `--img-format` for the image file type. The global `--format` flag is reserved for `opencli`'s table/json/yaml output rendering.

### 3. Requirements
- **Node.js**: Requires Node.js >= 20 (recommended v24+).
- **Daemon/Extension**: Requires the `opencli` daemon to be running or a valid `OPENCLI_CDP_ENDPOINT` to be set.
