/**
 * Xiaohongshu Export — export an arbitrary note to a Markdown file.
 * This version supports the new anti-crawler mechanism and uses __INITIAL_STATE__ for extraction.
 *
 * Usage:
 *   opencli xiaohongshu export "https://www.xiaohongshu.com/explore/abc?xsec_token=..." --output ./exports
 */

import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import { saveDocument } from '../../download/index.js';
import { extractNoteData, cleanNoteDesc, sanitizeFilename } from './note-helpers.js';

cli({
  site: 'xiaohongshu',
  name: 'export',
  description: '将任意小红书笔记导出为 Markdown 文件（含元数据、正文及媒体链接）',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'url', required: true, positional: true, help: 'Full Note URL (containing xsec_token)' },
    { name: 'output', default: './xiaohongshu-exports', help: 'Output directory' },
  ],
  columns: ['noteId', 'title', 'author', 'status'],
  func: async (page, kwargs) => {
    const fullUrl = kwargs.url;
    const output = kwargs.output;

    // Extract noteId from URL
    const noteIdMatch = fullUrl.match(/\/explore\/([^/?#]+)/);
    const noteId = noteIdMatch ? noteIdMatch[1] : null;
    if (!noteId) {
       throw new Error('Invalid XHS URL: Could not extract noteId');
    }

    // Navigate to the full URL
    await page.goto(fullUrl);
    
    // Wait for the state to be ready
    await page.wait(2);

    // Extract note info using helper
    const data = await extractNoteData(page, noteId);

    if ('error' in data) {
      throw new Error(data.error);
    }

    // Clean up description
    const cleanDesc = cleanNoteDesc(data.desc);

    // Format Markdown content
    const metadata = {
      title: data.title,
      author: `[[${data.author}]]`, // Obsidian double-link format
      userId: data.userId,
      published: data.time, // Renamed from publishTime
      lastUpdate: data.lastUpdateTime,
      created: new Date().toISOString(), // New field
      noteId: data.noteId,
      source: fullUrl, // Renamed from sourceUrl
      tags: data.tags,
    };

    let markdownBody = cleanDesc + '\n\n---\n\n';

    const hasVideo = data.media.some((m: any) => m.type === 'video');

    if (data.media && data.media.length > 0) {
      const videos = data.media.filter((m: any) => m.type === 'video');
      const images = data.media.filter((m: any) => m.type === 'image');

      if (videos.length > 0) {
        markdownBody += '## 视频\n\n';
        videos.forEach((v: any) => {
          markdownBody += `[点击播放视频](${v.url})\n\n`;
        });
      }

      if (images.length > 0) {
        // For video notes, usually the first image is the cover
        markdownBody += hasVideo ? '## 封面\n\n' : '## 图片\n\n';
        images.forEach((img: any) => {
          markdownBody += `![图片](${img.url})\n\n`;
        });
      }
    }

    // Save as Markdown file (Filename: date prefix + title)
    const safeTitle = sanitizeFilename(data.title || data.noteId);
    const datePrefix = data.time ? data.time.split('T')[0] + '-' : '';
    const filename = `${datePrefix}${safeTitle}.md`;
    const destPath = path.join(output, filename);

    const saveResult = await saveDocument(markdownBody, destPath, 'markdown', metadata);

    return [{
      noteId: data.noteId,
      title: data.title || '(no title)',
      author: data.author,
      status: saveResult.success ? `exported: ${filename}` : `failed: ${saveResult.error}`
    }];
  },
});
