import { cli, Strategy } from '../../registry.js';
import { saveSinaArticle } from './mobile-utils.js';

cli({
  site: 'sinablog',
  name: 'save',
  description: '将新浪博客文章保存为 Markdown，并下载其中的图片到本地（支持 Obsidian 格式）',
  domain: 'blog.sina.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'url', required: true, positional: true, help: '文章 URL（支持 blog.sina.cn 或 blog.sina.com.cn）' },
    { name: 'output', default: './sina-saves', help: '输出 .md 文件的目录' },
    { name: 'attachments', default: 'attachments', help: '附件文件夹名称 (默认: attachments)' },
    { name: 'collected', help: '可选：记录在元数据中的收藏时间' },
    { name: 'memo', help: '可选：记录在元数据中的简短备注' },
    { name: 'note', help: '可选：在 Markdown 内容前置的笔记内容' },
  ],
  columns: ['articleId', 'title', 'status'],
  func: async (page, kwargs) => {
    let url = String(kwargs.url);
    // Convert desktop URL to mobile URL for better parsing if needed
    if (url.includes('blog.sina.com.cn/s/blog_')) {
      const idMatch = url.match(/blog_([a-zA-Z0-9]+)\.html/);
      if (idMatch) {
         url = `https://blog.sina.cn/dpool/blog/s/blog_${idMatch[1]}.html`;
      }
    }

    const result = await saveSinaArticle(page, url, {
      output: String(kwargs.output),
      attachments: String(kwargs.attachments),
      collected: kwargs.collected ? String(kwargs.collected) : undefined,
      memo: kwargs.memo ? String(kwargs.memo) : undefined,
      note: kwargs.note ? String(kwargs.note) : undefined,
    });

    return [{
      articleId: result.noteId,
      title: result.title || '(无标题)',
      status: result.success ? `已保存至 ${result.filename}` : `失败: ${result.error}`
    }];
  },
});
