/**
 * Xiaohongshu Download (New) — downloads images and videos from a note URL.
 * This version supports the new anti-crawler mechanism and uses __INITIAL_STATE__ for extraction.
 *
 * Usage:
 *   opencli xiaohongshu download-new "https://www.xiaohongshu.com/explore/abc?xsec_token=..." --output ./downloads
 */

import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import {
  httpDownload,
  ytdlpDownload,
} from '../../download/index.js';
import { extractNoteData, NoteData } from './note-helpers.js';

cli({
  site: 'xiaohongshu',
  name: 'download-new',
  description: '使用完整 URL（支持 xsec_token + __INITIAL_STATE__）下载小红书笔记中的图片和视频',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'url', required: true, positional: true, help: 'Full Note URL (containing xsec_token)' },
    { name: 'output', default: './xiaohongshu-downloads', help: 'Output directory' },
  ],
  columns: ['index', 'type', 'status', 'size'],
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

    const results: any[] = [];
    const headers = {
      'Referer': 'https://www.xiaohongshu.com/',
      'User-Agent': await page.evaluate('() => navigator.userAgent') as string
    };

    // Download media
    for (let i = 0; i < data.media.length; i++) {
        const item = data.media[i];
        const ext = item.type === 'video' ? 'mp4' : 'jpg';
        const filename = `${noteId}_${i + 1}.${ext}`;
        const destPath = path.join(output, filename);
        
        let downloadResult;
        if (item.type === 'video') {
            // Use httpDownload for direct MP4 links
            downloadResult = await httpDownload(item.url, destPath, { headers });
        } else {
            downloadResult = await httpDownload(item.url, destPath, { headers });
        }

        results.push({
            index: i + 1,
            type: item.type,
            status: downloadResult.success ? 'success' : `failed: ${downloadResult.error}`,
            size: downloadResult.size > 0 ? `${(downloadResult.size / 1024 / 1024).toFixed(1)} MB` : '0 B'
        });
    }

    return results;
  },
});
