import { describe, expect, it } from 'vitest';
import {
  BrowserClickTool,
  BrowserExtractTool,
  BrowserFillTool,
  BrowserOpenTool,
  BrowserScreenshotTool,
} from './browser';

describe('browser tools', () => {
  it('requires approval for browser mutation tools only', () => {
    expect(new BrowserOpenTool().requiresApproval).toBe(false);
    expect(new BrowserExtractTool().requiresApproval).toBe(false);
    expect(new BrowserScreenshotTool().requiresApproval).toBe(false);
    expect(new BrowserClickTool().requiresApproval).toBe(true);
    expect(new BrowserFillTool().requiresApproval).toBe(true);
  });
});
