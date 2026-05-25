import { SelectItems } from '@gredice/ui/SelectItems';
import { expect, test } from '@playwright/experimental-ct-react';

const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' },
    { value: '4', label: 'Option 4' },
    { value: '5', label: 'Option 5' },
    { value: '6', label: 'Option 6' },
];

test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
});

test('stays open on touch after trigger tap and search input interaction', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <SelectItems
            items={options}
            label="Status"
            placeholder="Select status"
            searchable
        />,
    );

    const trigger = component.getByRole('combobox', { name: 'Status' });
    await trigger.tap();

    const search = page.getByRole('searchbox', {
        name: 'Pretraži opcije...',
    });

    await expect(search).toBeVisible();
    await page.waitForTimeout(100);
    await expect(search).toBeVisible();

    await search.tap();
    await search.fill('Option 2');

    await expect(search).toBeVisible();
    await expect(page.getByRole('option', { name: 'Option 2' })).toBeVisible();
});
