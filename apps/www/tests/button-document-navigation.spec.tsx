import { Button } from '@gredice/ui/Button';
import { expect, test } from './component-fixtures';

test('document links preserve loading and disabled click guards', async ({
    mount,
    page,
}) => {
    await mount(
        <div>
            <Button href="/novosti" navigation="document" disabled>
                Nedostupno
            </Button>
            <Button href="/novosti" navigation="document" loading>
                Učitavanje
            </Button>
        </div>,
    );
    const originalUrl = page.url();
    for (const name of ['Nedostupno', 'Učitavanje']) {
        const link = page.getByRole('link', { name });
        await expect(link).toHaveAttribute('aria-disabled', 'true');
        await expect(link).toHaveAttribute('tabindex', '-1');
        await link.click({ force: true });
        expect(page.url()).toBe(originalUrl);
    }
});
