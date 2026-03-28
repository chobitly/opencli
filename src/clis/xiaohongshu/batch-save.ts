import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import { saveNote, generateMarkdownTable } from './note-helpers.js';

cli({
  site: 'xiaohongshu',
  name: 'batch-save',
  description: '批量采集 Markdown 列表文件中标注好的笔记，并回写本地链接',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  args: [
    { name: 'file', required: true, positional: true, help: 'Path to the Markdown file containing the note list' },
    { name: 'output', default: './xiaohongshu-saves', help: 'Output directory for the .md files' },
    { name: 'novideo', type: 'boolean', default: false, help: 'Whether to skip download video' },
    { name: 'attachments', default: 'attachments', help: 'Name of the attachments folder' },
  ],
  columns: ['noteId', 'title', 'status'],
  func: async (page, kwargs) => {
    const filePath = path.resolve(String(kwargs.file));
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    // Markdown table parser
    const allRows: any[] = [];
    let headers: string[] = [];
    
    for (const line of lines) {
      if (!line.includes('|')) continue;
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
      throw new Error('No valid Markdown table found in the file.');
    }

    const results: any[] = [];
    for (const row of allRows) {
      const collectVal = row['collect']?.trim().toLowerCase();
      const isMarked = !!collectVal && collectVal !== '0';
      const noteUrl = row['url'];

      if (isMarked && noteUrl) {
        try {
          const saveResult = await saveNote(page, noteUrl, {
            output: String(kwargs.output),
            attachments: String(kwargs.attachments),
            novideo: !!kwargs.novideo,
            collected: row['collected'],
            memo: row['memo'],
            note: row['note'],
          });
          
          if (saveResult.success) {
            // Update the row with the local link for back-writing
            row['archive'] = `[[${saveResult.filename}]]`;
            // Also mark as '0' (already collected) to avoid double collection next time
            row['collect'] = '0';
          }

          results.push({
            noteId: saveResult.noteId,
            title: saveResult.title || '(no title)',
            status: saveResult.success ? `Success: ${saveResult.filename}` : `Failed: ${saveResult.error}`
          });
        } catch (err: any) {
          results.push({
            noteId: row['id'] || 'unknown',
            title: row['title'] || '(no title)',
            status: `Error: ${err.message}`
          });
        }
      }
    }

    // Rewrite the source file with updated archive links
    const updatedContent = generateMarkdownTable(allRows, headers);
    fs.writeFileSync(filePath, updatedContent, 'utf8');

    if (results.length === 0) {
      return [{ noteId: '-', title: '-', status: 'No items marked for collection or already collected (0)' }];
    }

    return results;
  },
});
