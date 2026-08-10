import { readFileSync } from 'node:fs';
import { validateSerializedStructuredData } from '../components/shared/seo/structuredDataValidation';
import { expect, test } from './fixtures';

test.describe('public SEO metadata', () => {
    const pages = JSON.parse(
        readFileSync('./tests/sitemap-pages.json', 'utf8'),
    ) as string[];
    for (const url of pages) {
        test(`page ${url} has valid SEO metadata`, async ({ page }) => {
            test.slow();

            await page.goto(`${url}`, {
                waitUntil: 'domcontentloaded',
            });

            if (url !== '/') {
                const title = await page.title();
                expect(title).not.toBe('Gredice - vrt po tvom');
            }

            const structuredDataScripts = await page
                .locator('script[type="application/ld+json"]')
                .allTextContents();

            structuredDataScripts.forEach((script, index) => {
                const issues = validateSerializedStructuredData(script);
                expect(
                    issues,
                    `Invalid structured data script ${index + 1} on ${url}: ${issues
                        .map((issue) => `${issue.path}: ${issue.message}`)
                        .join('; ')}`,
                ).toEqual([]);
            });
        });
    }
});
