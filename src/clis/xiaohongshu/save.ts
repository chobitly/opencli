/**
 * Xiaohongshu Save — export a note to Markdown and download media to local folder with relative links.
 *
 * Usage:
 *   opencli xiaohongshu save "https://www.xiaohongshu.com/explore/abc?xsec_token=..." --output ./saves --no-video --attachments media
 */

import { cli, Strategy } from '../../registry.js';
import { saveNote } from './note-helpers.js';

cli({
  site: 'xiaohongshu',
  name: 'save',
  description: '提取小红书笔记并下载媒体到本地，生成带本地引用的 Markdown 文件（支持 Obsidian 格式）',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'url', required: true, positional: true, help: 'Note URL (supports both full and short links)' },
    { name: 'output', default: './xiaohongshu-saves', help: 'Output directory for the .md file' },
    { name: 'novideo', type: 'boolean', default: false, help: 'Whether to skip download video (default: false).' },
    { name: 'attachments', default: 'attachments', help: 'Name of the attachments folder (default: attachments)' },
  ],
  columns: ['noteId', 'title', 'status'],
  func: async (page, kwargs) => {
    const result = await saveNote(page, String(kwargs.url), {
      output: String(kwargs.output),
      attachments: String(kwargs.attachments),
      novideo: !!kwargs.novideo,
    });

    return [{
      noteId: result.noteId,
      title: result.title || '(no title)',
      status: result.success ? `Saved to ${result.filename}` : `Failed: ${result.error}`
    }];
  },
});
