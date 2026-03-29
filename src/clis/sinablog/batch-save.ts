import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import { saveSinaArticle, generateMarkdownTable } from './mobile-utils.js';

cli({
  site: 'sinablog',
  name: 'batch-save',
  description: '批量采集 Markdown 列表文件中标注好的新浪博客文章，并回写本地链接',
  domain: 'blog.sina.cn',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'file', required: true, positional: true, help: '包含文章列表的 Markdown 文件路径' },
    { name: 'output', default: './sina-saves', help: '输出 .md 文件的目录' },
    { name: 'attachments', default: 'attachments', help: '附件文件夹名称' },
  ],
  columns: ['articleId', 'title', 'status'],
  func: async (page, kwargs) => {
    const filePath = path.resolve(String(kwargs.file));
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件未找到: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    // Markdown table parser
    const allRows: any[] = [];
    let headers: string[] = [];
    
    for (const line of lines) {
      if (!line.includes('|')) continue;
      // Extract parts between pipes
      const parts = line.split('|').map(s => s.trim()).filter((_s, i, arr) => i > 0 && i < arr.length - 1);
      
      if (line.includes('---')) continue;
      
      if (headers.length === 0) {
        headers = parts.map(h => h.toLowerCase());
        continue;
      }

      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = parts[i] || '';
      });
      allRows.push(row);
    }

    if (allRows.length === 0) {
      throw new Error('在文件中未找到有效的 Markdown 表格。');
    }

    const results: any[] = [];
    for (const row of allRows) {
      const collectVal = row['collect']?.trim().toLowerCase();
      // Trigger if mark is 'y', 'x', '1' or non-zero
      const isMarked = !!collectVal && collectVal !== '0' && collectVal !== '';
      const articleUrl = row['url'];

      if (isMarked && articleUrl) {
        try {
          const saveResult = await saveSinaArticle(page, articleUrl, {
            output: String(kwargs.output),
            attachments: String(kwargs.attachments),
            collected: row['collected'],
            memo: row['memo'],
            note: row['note'],
          });
          
          if (saveResult.success) {
            row['archive'] = `[[${saveResult.filename}]]`;
            row['collect'] = '0'; // Mark as processed
          }

          results.push({
            articleId: saveResult.noteId,
            title: saveResult.title || '(无标题)',
            status: saveResult.success ? `成功: ${saveResult.filename}` : `失败: ${saveResult.error}`
          });
        } catch (err: any) {
          results.push({
            articleId: row['id'] || 'unknown',
            title: row['title'] || '(无标题)',
            status: `错误: ${err.message}`
          });
        }
      }
    }

    // Rewrite source file
    const updatedContent = generateMarkdownTable(allRows, headers);
    fs.writeFileSync(filePath, updatedContent, 'utf8');

    if (results.length === 0) {
      return [{ articleId: '-', title: '-', status: '未发现标记为采集的项目（或均已采集 0）' }];
    }

    return results;
  },
});
