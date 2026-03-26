import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const screenshotCommand = cli({
  site: 'generic',
  name: 'screenshot',
  description: 'Capture a visual screenshot (PNG) of any page',
  strategy: Strategy.UI,
  browser: true,
  args: [
    { name: 'url', required: false, positional: true, help: 'URL to navigate to before screenshot' },
    { name: 'output', required: false, help: 'Output file path (default: ./screenshot.png)' },
    { name: 'full', required: false, help: 'Capture full scrollable page' },
    { name: 'quality', required: false, help: 'JPEG quality (0-100), only if format is jpeg' },
    { name: 'img-format', required: false, default: 'png', help: 'Output format (png or jpeg)' },
    { name: 'width', required: false, help: 'Viewport width (e.g. 1920, 1280, 750 for mobile)' },
  ],
  columns: ['Status', 'File', 'Size'],
  func: async (page: IPage, kwargs: any) => {
    if (kwargs.url) {
      await page.goto(kwargs.url, { waitUntil: 'load' });
    }

    const outputPath = (kwargs.output as string) || './screenshot.png';
    const absPath = path.resolve(outputPath);

    const base64 = await page.screenshot({
      path: absPath,
      fullPage: kwargs.full === true || kwargs.full === 'true',
      quality: kwargs.quality ? parseInt(kwargs.quality, 10) : undefined,
      format: kwargs['img-format'] as 'png' | 'jpeg',
      width: kwargs.width ? parseInt(kwargs.width, 10) : undefined,
    });

    const stats = fs.statSync(absPath);
    const sizeKB = Math.round(stats.size / 1024);

    return [
      {
        Status: 'Success',
        File: absPath,
        Size: `${sizeKB} KB`,
      },
    ];
  },
});
