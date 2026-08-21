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

test.describe('coarse pointer', () => {
    test.use({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
    });

    test('stays open without forcing the mobile keyboard', async ({
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
        await expect(search).not.toBeFocused();
        await page.waitForTimeout(100);
        await expect(search).toBeVisible();

        await search.tap();
        await search.fill('Option 2');

        await expect(search).toBeVisible();
        await expect(
            page.getByRole('option', { name: 'Option 2' }),
        ).toBeVisible();
        await page.getByRole('option', { name: 'Option 2' }).tap();
        await expect(trigger).toHaveText(/Option 2/);
    });
});

test('autofocuses search on a fine pointer and clears it before closing', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <SelectItems items={options} label="Status" searchable />,
    );

    const trigger = component.getByRole('combobox', { name: 'Status' });
    await trigger.click();

    const search = page.getByRole('searchbox', {
        name: 'Pretraži opcije...',
    });
    await expect(search).toBeFocused();

    await search.fill('Option 2');
    await expect(page.getByRole('option')).toHaveCount(1);
    await search.fill('missing option');
    await expect(page.getByText('Nema rezultata.')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(search).toHaveValue('');
    await expect(search).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(options.length);

    await page.keyboard.press('Escape');
    await expect(search).not.toBeVisible();
});

test('supports a controlled popup without controlledness warnings', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <SelectItems
            items={options.slice(0, 3)}
            label="Controlled status"
            onOpenChange={() => undefined}
            open
            value="1"
        />,
    );

    await expect(page.getByRole('option', { name: 'Option 1' })).toBeVisible();
    await expect(
        component.getByRole('combobox', { name: 'Controlled status' }),
    ).toHaveText(/Option 1/);

    await component.update(
        <SelectItems
            items={options.slice(0, 3)}
            label="Controlled status"
            onOpenChange={() => undefined}
            open={false}
            value="2"
        />,
    );
    await expect(
        page.getByRole('option', { name: 'Option 1' }),
    ).not.toBeVisible();
    await expect(
        component.getByRole('combobox', { name: 'Controlled status' }),
    ).toHaveText(/Option 2/);
});

test('keeps externally filtered results without filtering them twice', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <SelectItems
            clientSideFilter={false}
            dir="rtl"
            items={[{ value: 'account-1', label: 'Green Farm' }]}
            label="Account"
            onSearchValueChange={() => undefined}
            searchable
            searchValue="remote query"
        />,
    );

    await page.getByRole('combobox', { name: 'Account' }).click();
    const search = page.getByRole('searchbox', {
        name: 'Pretraži opcije...',
    });
    await expect(search).toHaveValue('remote query');
    await expect(
        page.getByRole('option', { name: 'Green Farm' }),
    ).toBeVisible();
    await expect(
        page
            .locator('[dir="rtl"]')
            .filter({ has: page.getByRole('option', { name: 'Green Farm' }) }),
    ).toHaveCount(1);

    await component.update(
        <SelectItems
            clientSideFilter={false}
            dir="rtl"
            items={[{ value: 'account-2', label: 'Blue Farm' }]}
            label="Account"
            onSearchValueChange={() => undefined}
            open
            searchable
            searchValue="updated query"
        />,
    );
    await expect(search).toHaveValue('updated query');
    await expect(page.getByRole('option', { name: 'Blue Farm' })).toBeVisible();
});

test('uses the ordinary select path and serializes an empty value', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <SelectItems
            defaultOpen
            defaultValue=""
            dir="rtl"
            items={[
                { value: '', label: 'All values' },
                { value: 'active', label: 'Active' },
            ]}
            label="Filter"
            name="status"
        />,
    );

    const trigger = component.getByRole('combobox', { name: 'Filter' });
    await expect(trigger).toHaveText(/All values/);
    await expect(page.locator('input[name="status"]')).toHaveValue('');

    await expect(page.getByRole('option', { name: 'Active' })).toBeVisible();
    await expect(
        page
            .locator('[dir="rtl"]')
            .filter({ has: page.getByRole('option', { name: 'Active' }) }),
    ).toHaveCount(1);
    await page.getByRole('option', { name: 'Active' }).click();
    await expect(trigger).toHaveText(/Active/);
    await expect(page.locator('input[name="status"]')).toHaveValue('active');
});
