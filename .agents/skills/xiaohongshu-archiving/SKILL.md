---
name: xiaohongshu-archiving
description: Skills for archiving Xiaohongshu notes to Markdown and downloading high-quality watermark-free media.
---

# Xiaohongshu Archiving Skill

> [!NOTE]
> **人眼快读 / Human Quick Guide**
> 
> ### 全能存储命令：`xiaohongshu save`
> - **默认行为**：同时保存 Markdown 笔记、高清图片和视频到指定文件夹。
> - **Obsidian 适配**：使用 `![[./attachments/xxx]]` 语法，支持在 Obsidian 中直接预览视频和图片。
> - **文件名规范**：自动以 `YYYY-MM-DD-标题` 命名，方便按日期排序。
> - **自定义保存路径**：通过 `--output my-folder` 修改保存路径。
> - **自定义附件文件夹**：通过 `--attachments my-assets` 修改附件存放路径。
> - **仅存图片**：使用 `--novideo` 参数跳过视频下载。
> ### 快速示例：
> - 默认模式（默认输出到 ./xiaohongshu-saves）：
>   - `opencli xiaohongshu save "URL"`
> - 默认模式且采集在当前文件夹下：
>   - `opencli xiaohongshu save "URL" --output ./`
> - 指定附件目录 + 不下载视频（仅保存图片）
>   - `opencli xiaohongshu save "URL" --novideo --attachments my-assets`
> ---
> **AI Agent Note**: Skip the section above and follow the technical specifications below.

## Core Capabilities

### 1. Full Note Archiving (`save`)
The primary tool for archiving. It creates a Markdown file with full metadata and downloads all associated media into a local folder.

**Command:**
```bash
opencli xiaohongshu save "<URL>" [options]
```

**Options:**
- `--output <path>`: Directory where the `.md` file will be saved.
- `--novideo`: Skip downloading video (downloads only images).
- `--attachments <name>`: Custom name for the folder containing images/videos (default: `attachments`).

**URL Support:**
- **Full URL**: Browser address bar URL (e.g., `https://www.xiaohongshu.com/explore/...`).
- **Short Link**: Mobile app sharing link (e.g., `http://xhslink.com/o/...`).

**Output Format:**
- **Filename**: `YYYY-MM-DD-Title.md` (Prefixed with publish date).
- **Metadata (YAML)**:
  - `published`: Original publish time.
  - `created`: Archiving timestamp.
  - `source`: Original URL.
  - `author`: `[[Author]]` (Obsidian double-link).
- **Embedded Media**: Obsidian-style double-link embedding: `![[./attachments/filename.mp4]]`.

---

### 2. High-Quality Media Download (`download-new`)
Specifically designed to bypass Xiaohongshu's anti-scraping and `blob:` protocol issues to get raw MP4/JPG files.

**Command:**
```bash
opencli xiaohongshu download-new "<URL>" --output <path>
```
- **Feature**: Prioritizes H.265, watermark-free (`No-WM`) video streams.
- **URL Support**: Supports both full and short URLs.

---

### 3. Markdown Export Only (`export`)
Generates a Markdown file with remote links only. Use this if you don't need local media storage.

**Command:**
```bash
opencli xiaohongshu export "<URL>" --output <path>
```
- **URL Support**: Supports both full and short URLs.

---

## Technical Requirements & Best Practices
- **URL Support**: Supports both full browser URLs and short sharing links from the mobile app.
- **Auth**: These commands rely on the user's browser cookie (active session in Chrome).
- **Obsidian Compatibility**: The `save` command is fully optimized for Obsidian vaults.
