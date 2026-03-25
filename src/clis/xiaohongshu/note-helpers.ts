import * as path from 'node:path';
import * as fs from 'node:fs';
import { IPage } from '../../types.js';
import { saveDocument, httpDownload } from '../../download/index.js';

export interface NoteData {
  noteId: string;
  title: string;
  desc: string;
  author: string;
  userId: string;
  time: string;
  lastUpdateTime: string;
  tags: string[];
  media: Array<{
    type: 'video' | 'image';
    url: string;
    codec?: string;
    resolution?: number;
  }>;
}

/**
 * Extracts note information from window.__INITIAL_STATE__
 */
export async function extractNoteData(page: IPage, noteId: string): Promise<NoteData | { error: string }> {
  const data: any = await page.evaluate(`
    (() => {
      const nid = "${noteId}";
      const state = window.__INITIAL_STATE__;
      const noteDetail = state?.note?.noteDetailMap?.[nid]?.note;
      
      if (!noteDetail) {
        return { error: 'Note detail not found in __INITIAL_STATE__. Check if you are logged in or if the URL/token is valid.' };
      }

      const result = {
        noteId: nid,
        title: noteDetail.title || '',
        desc: noteDetail.desc || '',
        author: noteDetail.user?.nickname || 'unknown',
        userId: noteDetail.user?.userId || '',
        time: noteDetail.time ? new Date(noteDetail.time).toISOString() : '',
        lastUpdateTime: noteDetail.lastUpdateTime ? new Date(noteDetail.lastUpdateTime).toISOString() : '',
        tags: (noteDetail.tagList || []).map(t => t.name),
        media: []
      };

      // 1. Handle Video
      if (noteDetail.video?.media?.stream) {
        const streamsMap = noteDetail.video.media.stream;
        const codecs = ['h265', 'h264', 'av1', 'h266'];
        let bestStream = null;

        for (const codec of codecs) {
          const streamList = streamsMap[codec];
          if (Array.isArray(streamList) && streamList.length > 0) {
            const candidates = [...streamList].sort((a, b) => (b.resolution || 0) - (a.resolution || 0));
            // Prioritize non-watermarked streams
            const nonWm = candidates.find(s => !s.streamDesc?.toLowerCase().includes('wm_'));
            if (nonWm) {
              bestStream = { ...nonWm, codec };
              break;
            }
            if (!bestStream) bestStream = { ...candidates[0], codec };
          }
        }

        if (bestStream && bestStream.masterUrl) {
          result.media.push({
            type: 'video',
            url: bestStream.masterUrl,
            codec: bestStream.codec,
            resolution: bestStream.resolution
          });
        }
      }

      // 2. Handle Images
      if (noteDetail.imageList && noteDetail.imageList.length > 0) {
        noteDetail.imageList.forEach((img) => {
          let url = img.urlDefault || img.url || '';
          if (url) {
            if (!url.startsWith('http')) url = 'https:' + url;
            result.media.push({
              type: 'image',
              url: url
            });
          }
        });
      }

      return result;
    })()
  `);

  return data;
}

export interface SaveNoteOptions {
  output: string;
  attachments: string;
  novideo?: boolean;
}

/**
 * Core logic for saving a single Xiaohongshu note.
 */
export async function saveNote(page: IPage, noteUrl: string, options: SaveNoteOptions) {
  const { output: outputBase, attachments: attachmentsDirName, novideo = false } = options;
  const shouldDownloadVideo = !novideo;

  // Navigate first (to handle short URL redirects)
  await page.goto(noteUrl);
  await page.wait(2);

  // Extract noteId from the current URL (after potential redirect)
  const currentUrl = await page.evaluate('window.location.href') as string;
  const noteIdMatch = currentUrl.match(/\/explore\/([^/?#]+)/);
  const noteId = noteIdMatch ? noteIdMatch[1] : null;

  if (!noteId) {
    throw new Error(`Invalid XHS URL: Could not extract noteId from ${currentUrl}`);
  }

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
    published: data.time,
    lastUpdate: data.lastUpdateTime,
    created: new Date().toISOString(),
    noteId: data.noteId,
    source: noteUrl,
    tags: data.tags,
  };

  const hasVideo = data.media.some((m) => m.type === 'video');

  // Process Media
  let mediaCount = 0;
  for (const item of data.media) {
    mediaCount++;
    const isVideo = item.type === 'video';

    if (isVideo && !shouldDownloadVideo) {
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

  return {
    success: saveResult.success,
    filename: mdFilename,
    error: saveResult.error,
    noteId: data.noteId,
    title: data.title
  };
}

/**
 * Cleans up Xiaohongshu description by removing [话题]# tags.
 */
export function cleanNoteDesc(desc: string): string {
  if (!desc) return '';
  return desc.replace(/\[话题\]#/g, '').trim();
}

/**
 * Sanitizes a string for use as a filename.
 */
export function sanitizeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}
