import { expect, test } from '@playwright/experimental-ct-react';
import { PlantTipsHarness } from './PlantTipsHarness';
import '../app/globals.css';

test('renders plant advice content as markdown', async ({ mount, page }) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
    );

    await mount(
        <PlantTipsHarness
            plant={{
                id: 1,
                information: {
                    tip: [
                        {
                            header: 'Zalijevanje',
                            content:
                                'Koristi **malč** za vlagu.\n\n- Provjeri tlo\n\n[Više savjeta](/savjeti)',
                        },
                    ],
                },
            }}
        />,
    );

    await expect(page.getByRole('heading', { name: 'Savjeti' })).toBeVisible();
    await expect(page.locator('strong', { hasText: 'malč' })).toBeVisible();
    await expect(page.getByRole('listitem')).toContainText('Provjeri tlo');
    await expect(
        page.getByRole('link', { name: 'Više savjeta' }),
    ).toHaveAttribute('href', '/savjeti');
});
