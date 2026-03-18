import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const readCommand = cli({
  site: 'chatgpt',
  name: 'read',
  description: 'Copy the most recent ChatGPT Desktop App response to clipboard and read it',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null) => {
    try {
      execSync("osascript -e 'tell application \"ChatGPT\" to activate'");
      execSync("osascript -e 'delay 0.5'");
      execSync("osascript -e 'tell application \"System Events\" to keystroke \"c\" using {command down, shift down}'");
      execSync("osascript -e 'delay 0.3'");

      const result = execSync('pbpaste', { encoding: 'utf-8' }).trim();
      
      if (!result) {
        return [{ Role: 'System', Text: 'No text was copied. Is there a response in the chat?' }];
      }

      return [{ Role: 'Assistant', Text: result }];
    } catch (err: any) {
      throw new Error("Failed to read from ChatGPT: " + err.message);
    }
  },
});
