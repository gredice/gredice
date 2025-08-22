
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

test.describe('titles present', () => {
  const pages = JSON.parse(readFileSync('./tests/sitemap-pages.json', 'utf8')) as string[];
  for (const url of pages) {
    test(`page ${url} does not have generic title`, async ({ page }) => {
      test.slow();

      // Skip landing page
      if (url === '/') return;

      await page.goto(`${url}`, {
        waitUntil: 'domcontentloaded'
      });
      const title = await page.title();
      expect(title).not.toBe('Gredice - vrt po tvom');
    });
  }
});
