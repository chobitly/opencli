/**
 * Xiaohongshu Save — export a note to Markdown and download media to local folder with relative links.
 *
 * Usage:
 *   opencli xiaohongshu save "https://www.xiaohongshu.com/explore/abc?xsec_token=..." --output ./saves --no-video --attachments media
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { cli, Strategy } from '../../registry.js';
import { saveDocument, httpDownload } from '../../download/index.js';
import { extractNoteData, cleanNoteDesc, sanitizeFilename } from './note-helpers.js';

cli({
  site: 'xiaohongshu',
  name: 'save',
  description: '提取小红书笔记并下载媒体到本地，生成带本地引用的 Markdown 文件（支持 Obsidian 格式）',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'url', required: true, positional: true, help: 'Full Note URL (containing xsec_token)' },
    { name: 'output', default: './xiaohongshu-saves', help: 'Output directory for the .md file' },
    // Changed name back to 'video' with default true to support --no-video via corrected commanderAdapter
    { name: 'novideo', type: 'boolean', default: false, help: 'Whether to skip download video (default: false).' },
    { name: 'attachments', default: 'attachments', help: 'Name of the attachments folder (default: attachments)' },
  ],
  columns: ['noteId', 'title', 'status'],
  func: async (page, kwargs) => {
    const fullUrl = kwargs.url;
    const outputBase = kwargs.output;
    const shouldDownloadVideo = !kwargs.novideo; // Default is true, --novideo sets it to false
    const attachmentsDirName = kwargs.attachments;

    // Extract noteId from URL
    const noteIdMatch = fullUrl.match(/\/explore\/([^/?#]+)/);
    const noteId = noteIdMatch ? noteIdMatch[1] : null;
    if (!noteId) {
      throw new Error('Invalid XHS URL: Could not extract noteId');
    }

    // Navigate and extract
    await page.goto(fullUrl);
    await page.wait(2);
    const data = await extractNoteData(page, noteId);
    if ('error' in data) {
      throw new Error(data.error);
    }

    // Prepare paths
    const mediaFolderPath = path.join(outputBase, attachmentsDirName);

    if (!fs.existsSync(mediaFolderPath)) {
      fs.mkdirSync(mediaFolderPath, { recursive: true });
    }

    const headers = {
      'Referer': 'https://www.xiaohongshu.com/',
      'User-Agent': await page.evaluate('() => navigator.userAgent') as string
    };

    let markdownBody = cleanNoteDesc(data.desc) + '\n\n---\n\n';
    const metadata = {
      title: data.title,
      author: `[[${data.author}]]`,
      userId: data.userId,
      published: data.time, // Renamed from publishTime
      lastUpdate: data.lastUpdateTime,
      created: new Date().toISOString(), // New field
      noteId: data.noteId,
      source: fullUrl, // Renamed from sourceUrl
      tags: data.tags,
    };

    const hasVideo = data.media.some((m) => m.type === 'video');

    // Process Media
    let mediaCount = 0;
    for (const item of data.media) {
      mediaCount++;
      const isVideo = item.type === 'video';

      if (isVideo && !shouldDownloadVideo) {
        // Skip video download but keep a remote link
        markdownBody += `## 视频 (未下载)\n\n[点击播放远程链接](${item.url})\n\n`;
        continue;
      }

      const ext = isVideo ? 'mp4' : 'jpg';
      const localFilename = `${data.noteId}_${mediaCount}.${ext}`;
      const destPath = path.join(mediaFolderPath, localFilename);
      const downloadResult = await httpDownload(item.url, destPath, { headers });

      if (downloadResult.success) {
        const relativePath = `./${attachmentsDirName}/${localFilename}`;
        if (isVideo) {
          markdownBody += `## 视频\n\n![[${relativePath}]]\n\n`;
        } else {
          const finalLabel = (hasVideo && item.type === 'image' && mediaCount === 2) ? '封面' : '图片';
          markdownBody += `## ${finalLabel}\n\n![[${relativePath}]]\n\n`;
        }
      } else {
        markdownBody += `## ${isVideo ? '视频' : '图片'} (下载失败)\n\n![${isVideo ? '播放' : '预览'}](${item.url})\n\n`;
      }
    }

    // Save Markdown (Filename: date prefix + title)
    const safeTitle = sanitizeFilename(data.title || data.noteId);
    const datePrefix = data.time ? data.time.split('T')[0] + '-' : '';
    const mdFilename = `${datePrefix}${safeTitle}.md`;
    const mdPath = path.join(outputBase, mdFilename);
    const saveResult = await saveDocument(markdownBody, mdPath, 'markdown', metadata);

    return [{
      noteId: data.noteId,
      title: data.title || '(no title)',
      status: saveResult.success ? `Saved to ${mdFilename}` : `Failed: ${saveResult.error}`
    }];
  },
});
