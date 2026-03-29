import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import { fetchMobileArticleList, generateMarkdownTable } from './mobile-utils.js';

cli({
  site: 'sinablog',
  name: 'user-collection',
  description: '获取新浪博客用户的文章列表，并生成带 collect 和 archive 列的 Markdown 表格',
  domain: 'blog.sina.cn',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'uid', type: 'string', required: true, positional: true, help: '新浪博客用户ID（如 1446825214）' },
    { name: 'limit', type: 'int', default: 2000, help: '获取的文章数量上限（默认：2000）' },
    { name: 'output', type: 'string', help: '可选：将生成的 Markdown 表格直接保存到此文件' },
  ],
  columns: ['collect', 'archive', 'id', 'title', 'pubtime', 'url'],
  func: async (page, kwargs) => {
    const uid = String(kwargs.uid);
    const limit = Math.max(1, Number(kwargs.limit ?? 50));

    // Sina mobile API is public, no login usually needed for listing
    const results = await fetchMobileArticleList(page, uid, limit);

    if (results.length === 0) {
      throw new Error(`未找到用户 ${uid} 的公开文章。`);
    }

    const COLUMNS = ['collect', 'archive', 'id', 'title', 'pubtime', 'collected', 'memo', 'note', 'url'];
    const finalResults = results.map(r => ({
      collect: 'y',
      archive: '',
      id: r.articleId,
      title: r.title,
      pubtime: r.pubtime,
      collected: '',
      memo: '',
      note: '',
      url: r.url
    }));

    if (kwargs.output) {
      const outputPath = path.resolve(String(kwargs.output));
      const mdContent = generateMarkdownTable(finalResults, COLUMNS);
      fs.writeFileSync(outputPath, mdContent, 'utf8');
      return [{
        collect: '✅',
        archive: '-',
        id: '-',
        title: `已将采集列表保存至: ${kwargs.output}`,
        pubtime: '-',
        url: '-'
      }];
    }

    return finalResults;
  },
});
