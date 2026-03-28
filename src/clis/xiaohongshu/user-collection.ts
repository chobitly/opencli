import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import { extractXhsUserNotes, normalizeXhsUserId } from './user-helpers.js';
import { generateMarkdownTable } from './note-helpers.js';

async function readUserSnapshot(page: any) {
  return await page.evaluate(`
    (() => {
      const safeClone = (value) => {
        try {
          return JSON.parse(JSON.stringify(value ?? null));
        } catch {
          return null;
        }
      };

      const userStore = window.__INITIAL_STATE__?.user || {};
      return {
        noteGroups: safeClone(userStore.notes?._value || userStore.notes || []),
        pageData: safeClone(userStore.userPageData?._value || userStore.userPageData || {}),
      };
    })()
  `);
}

cli({
  site: 'xiaohongshu',
  name: 'user-collection',
  description: 'Get public notes from a user profile with collect and archive columns',
  domain: 'www.xiaohongshu.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'id', type: 'string', required: true, positional: true, help: 'User id or profile URL' },
    { name: 'limit', type: 'int', default: 15, help: 'Number of notes to return' },
    { name: 'output', type: 'string', help: 'Optional: save the Markdown table directly to this file' },
  ],
  columns: ['collect', 'archive', 'id', 'title', 'type', 'likes', 'url'],
  func: async (page, kwargs) => {
    const userId = normalizeXhsUserId(String(kwargs.id));
    const limit = Math.max(1, Number(kwargs.limit ?? 15));

    await page.goto(`https://www.xiaohongshu.com/user/profile/${userId}`);

    let snapshot = await readUserSnapshot(page);
    let results = extractXhsUserNotes(snapshot ?? {}, userId);
    let previousCount = results.length;

    for (let i = 0; results.length < limit && i < 30; i += 1) {
      await page.autoScroll({ times: 1, delayMs: 1500 });
      await page.wait(1);

      snapshot = await readUserSnapshot(page);
      const nextResults = extractXhsUserNotes(snapshot ?? {}, userId);
      if (nextResults.length <= previousCount) break;

      results = nextResults;
      previousCount = nextResults.length;
    }

    if (results.length === 0) {
      throw new Error('No public notes found for this Xiaohongshu user.');
    }

    const COLUMNS = ['collect', 'archive', 'id', 'title', 'type', 'likes', 'collected', 'memo', 'note', 'url'];
    const finalResults = results.slice(0, limit).map(r => ({ collect: 'y', archive: '', collected: '', memo: '', note: '', ...r }));

    if (kwargs.output) {
      const outputPath = path.resolve(String(kwargs.output));
      const mdContent = generateMarkdownTable(finalResults, COLUMNS);
      fs.writeFileSync(outputPath, mdContent, 'utf8');
      return [{
        collect: '✅',
        archive: '-',
        id: '-',
        title: `Saved collection list to: ${kwargs.output}`,
        type: '-',
        likes: '-',
        url: '-'
      }];
    }

    return finalResults;
  },
});
