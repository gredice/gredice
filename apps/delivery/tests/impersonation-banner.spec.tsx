import { ImpersonationBanner } from '@gredice/ui/ImpersonationBanner';
import { expect, test } from '@playwright/experimental-ct-react';
import '../app/globals.css';

test('delivery shows the active impersonation controls', async ({
    context,
    mount,
    page,
}) => {
    await context.addCookies([
        {
            domain: '127.0.0.1',
            name: 'gredice_impersonating',
            path: '/',
            value: '1',
        },
        {
            domain: 'localhost',
            name: 'gredice_impersonating',
            path: '/',
            value: '1',
        },
    ]);

    await mount(<ImpersonationBanner />);

    await expect(page.getByText('Impersonacija je aktivna.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prekini' })).toBeVisible();
    await expect(page.locator('form')).toHaveAttribute(
        'action',
        'http://localhost:3003/api/users/stop-impersonate',
    );
});
