import { expect, test } from '@playwright/experimental-ct-react';
import { SearchInteractive } from '../app/pretraga/SearchInteractive';
import '../app/globals.css';

const longSummary = Array.from(
    { length: 16 },
    () =>
        'Patlidzan has a detailed growing note with enough words to exceed the visible summary height in a search result card.',
).join(' ');

test('search result summary fade appears only for clipped content', async ({
    mount,
}) => {
    const component = await mount(
        <div className="w-[900px] p-4">
            <SearchInteractive
                query="pa"
                selectedCategory="all"
                page={1}
                hasNextPage={false}
                results={[
                    {
                        entityId: 1,
                        entityType: 'plant',
                        categoryLabel: 'Biljke',
                        title: 'Patlidzan',
                        summary: 'Short summary.',
                        imageUrl: null,
                        imageAlt: null,
                        href: 'https://www.gredice.com/biljke/patlidzan',
                    },
                    {
                        entityId: 2,
                        entityType: 'plantSort',
                        categoryLabel: 'Sorte',
                        title: 'Patlidzan Black Beauty',
                        summary: longSummary,
                        imageUrl: null,
                        imageAlt: null,
                        href: 'https://www.gredice.com/biljke/patlidzan/sorte/black-beauty',
                    },
                ]}
            />
        </div>,
    );

    const summaries = component.locator('[data-search-result-summary]');
    await expect(summaries).toHaveCount(2);
    await expect(summaries.nth(0)).toHaveAttribute('data-overflowing', 'false');
    await expect(summaries.nth(1)).toHaveAttribute('data-overflowing', 'true');
    await expect(summaries.nth(0)).not.toHaveClass(/after:bg-gradient-to-b/);
    await expect(summaries.nth(1)).toHaveClass(/after:bg-gradient-to-b/);
});
