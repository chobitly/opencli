/**
 * Shared helpers and types for Xiaohongshu note extraction.
 */

import { IPage } from '../../types.js';

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
