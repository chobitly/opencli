import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IPage } from '../../types.js';
import { httpDownload, sanitizeFilename } from '../../download/index.js';

export interface SinaArticleMetadata {
  articleId: string;
  title: string;
  author: string;
  pubtime: string;
  url: string;
  abstract?: string;
}

/**
 * Fetch article list from Sina Blog mobile API.
 */
export async function fetchMobileArticleList(page: IPage, uid: string, limit: number = 20): Promise<SinaArticleMetadata[]> {
  const pageSize = 20;
  const articles: SinaArticleMetadata[] = [];
  let currentPage = 1;

  while (articles.length < limit) {
    const data: any = await page.evaluate(`
      (async () => {
        const formData = new URLSearchParams();
        formData.append('uid', ${JSON.stringify(uid)});
        formData.append('pagesize', ${pageSize});
        formData.append('page', ${currentPage});
        formData.append('class_id', '-1');
        
        const res = await fetch('https://blog.sina.cn/dpool/blog/newblog/riaapi/mblog/get_articlelist.php', {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        return res.json();
      })()
    `);

    if (data.code !== 'A00006' || !data.data || !data.data.msg || data.data.msg.length === 0) break;

    const items = data.data.msg.map((item: any) => ({
      articleId: item.article_id,
      title: (item.article_title || '').trim(),
      author: '', // We'll fill this later or from list context
      pubtime: item.pubtime,
      url: `https://blog.sina.cn/dpool/blog/s/blog_${item.article_id}.html`,
      abstract: item.abstract
    }));

    articles.push(...items);
    if (articles.length >= limit || articles.length >= parseInt(data.data.total || '0', 10)) break;
    currentPage++;
  }

  return articles.slice(0, limit);
}

/**
 * Extract article content from mobile page.
 */
export async function extractMobileArticleContent(page: IPage, url: string) {
  await page.goto(url);
  await page.wait({ selector: '.content.b-txt1', timeout: 5 });

  return await page.evaluate(`
    (() => {
      const normalize = (v) => (v || '').trim();
      const titleNode = document.querySelector('.new-head h1');
      const title = titleNode ? normalize(titleNode.textContent) : '';
      
      const authorNode = document.querySelector('.name a, .name');
      const author = authorNode ? normalize(authorNode.textContent) : '';
      
      const pubtimeNode = document.querySelector('.b-txt3.read-time span.time');
      const pubtime = pubtimeNode ? normalize(pubtimeNode.textContent) : '';
      
      const contentNode = document.querySelector('.content.b-txt1');
      if (!contentNode) return null;

      // Extract images and replace with placeholders or handle separately
      const images = [];
      const imageNodes = contentNode.querySelectorAll('img');
      imageNodes.forEach((img, index) => {
        let src = img.getAttribute('src') || img.getAttribute('real_src') || '';
        if (src && !src.includes('icon')) {
          // Normalize URL
          if (src.startsWith('//')) src = 'https:' + src;
          else if (src.startsWith('/')) src = 'https://blog.sina.cn' + src;
          
          images.push({ src, index });
          // Temporarily tag it for replacement
          img.setAttribute('data-opencli-idx', index);
        }
      });

      return {
        title,
        author,
        pubtime,
        html: contentNode.innerHTML,
        images,
        text: contentNode.innerText
      };
    })()
  `);
}

/**
 * Simple HTML to Markdown conversion (basic).
 */
export function basicHtmlToMd(html: string): string {
  // Very basic conversion: replace <p> with newlines, remove tags, handle <img>
  let md = html
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');

  // Handle images with special attribute
  md = md.replace(/<img[^>]*data-opencli-idx="(\d+)"[^>]*>/gi, (match, idx) => {
    return `\n![[image_${idx}]]\n`;
  });

  // Strip remaining tags
  md = md.replace(/<[^>]+>/g, '');
  
  return md.trim();
}

/**
 * Download images and save article.
 */
export async function saveSinaArticle(page: IPage, url: string, options: {
  output: string;
  attachments: string;
  novideo?: boolean;
  collected?: string;
  memo?: string;
  note?: string;
}): Promise<{ success: boolean; filename?: string; title?: string; noteId?: string; error?: string }> {
  try {
    const detail = await extractMobileArticleContent(page, url);
    if (!detail) throw new Error('Failed to extract article content.');

    const { title, author, pubtime, images, html } = detail;
    
    // Create output directory
    const baseDir = path.resolve(options.output);
    const attachmentsDir = path.join(baseDir, options.attachments);
    if (!fs.existsSync(attachmentsDir)) fs.mkdirSync(attachmentsDir, { recursive: true });

    // Download images
    const localImageMap: Record<string, string> = {};
    for (const img of images) {
      const ext = '.jpg'; // Sina images are usually jpg
      const filename = `img_${img.index}${ext}`;
      const destPath = path.join(attachmentsDir, filename);
      
      // Some Sina image URLs need Referer or are public
      await httpDownload(img.src, destPath, {
        headers: { 'Referer': 'https://blog.sina.cn/' }
      });
      localImageMap[img.index] = `./${options.attachments}/${filename}`;
    }

    // Final Markdown content
    let contentMd = basicHtmlToMd(html);
    
    // Replace [[image_N]] with Obsidian style ![[./attachments/img_N.jpg]]
    for (const [idx, localPath] of Object.entries(localImageMap)) {
      contentMd = contentMd.replace(`![[image_${idx}]]`, `![[${localPath}]]`);
    }

    if (options.note) {
      contentMd = `${options.note}\n\n---\n\n${contentMd}`;
    }

    const dateStr = pubtime.split(' ')[0] || new Date().toISOString().split('T')[0];
    const safeTitle = sanitizeFilename(title || 'untitled');
    const filename = `${dateStr}-${safeTitle}.md`;
    const fullPath = path.join(baseDir, filename);

    const metadata = {
      published: pubtime,
      created: new Date().toISOString(),
      source: url,
      author: `[[${author}]]`,
      collected: options.collected || '',
      memo: options.memo || '',
    };

    const frontmatter = `---\n${Object.entries(metadata).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n`;
    fs.writeFileSync(fullPath, frontmatter + contentMd, 'utf8');

    return { success: true, filename, title, noteId: url.split('_').pop()?.split('.')[0] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Generates a Markdown table string from an array of objects and column keys.
 */
export function generateMarkdownTable(data: any[], columns: string[]): string {
  if (data.length === 0) return '';
  const header = '| ' + columns.join(' | ') + ' |';
  const divider = '| ' + columns.map(() => '---').join(' | ') + ' |';
  const rows = data.map(row => '| ' + columns.map(c => String(row[c] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |');
  return [header, divider, ...rows].join('\n');
}
