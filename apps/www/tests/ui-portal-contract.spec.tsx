import { Modal } from '@gredice/ui/Modal';
import { expect, test } from '@playwright/experimental-ct-react';
import '../app/globals.css';

test('keeps portaled overlays outside the isolated application root', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        document.body.setAttribute('data-gredice-ui-portal-root', '');
    });

    await mount(
        <div className="gredice-ui-application-root" data-gredice-ui-root="">
            <Modal open title="Provjera portala">
                Sadržaj portala
            </Modal>
        </div>,
    );

    const applicationRoot = page.locator('[data-gredice-ui-root]');
    const dialog = page.getByRole('dialog', { name: 'Provjera portala' });

    await expect(dialog).toBeVisible();
    await expect(applicationRoot.getByRole('dialog')).toHaveCount(0);
    await expect(applicationRoot).toHaveCSS('isolation', 'isolate');
    await expect(page.locator('body')).toHaveCSS('position', 'relative');
    expect(
        await dialog.evaluate(
            (element) =>
                document.body.contains(element) &&
                element.closest('[data-gredice-ui-root]') === null,
        ),
    ).toBe(true);
});
