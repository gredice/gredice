import { expect, test } from '@playwright/experimental-ct-react';
import {
    ItemsHudAlignmentStory,
    ItemsHudDragStateStory,
    LocalSandboxItemsHudStory,
} from './ItemsHudStory';

test('autumn collections remain readable and keyboard reachable on mobile', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<ItemsHudAlignmentStory />);
    const autumn = page.getByRole('button', { name: 'Jesen', exact: true });
    await autumn.focus();
    await page.keyboard.press('Enter');
    for (const name of [
        'Jesenska berba',
        'Šumski kutak',
        'Topla večer',
        'Jesenski vrt',
        'Kestenijada',
        'Noć bundeva',
    ]) {
        const group = page.getByRole('button', { name, exact: true });
        await expect(group).toBeVisible();
        const label = page
            .locator('[data-items-picker-group-label]')
            .filter({ hasText: name });
        const box = await label.boundingBox();
        expect(box?.width).toBeLessThanOrEqual(80);
        const image = group.getByRole('img', { name, exact: true });
        await expect(image).toHaveAttribute('src', /.+/);
    }
    const harvest = page.getByRole('button', {
        name: 'Jesenska berba',
        exact: true,
    });
    await harvest.focus();
    await page.keyboard.press('Enter');
    const picker = page.locator('[data-active-items-picker="Jesenska berba"]');
    await expect(picker).toBeVisible();
    const bounds = await picker.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
    const pumpkin = picker.locator(
        '[data-items-hud-entity="HarvestPumpkinSquatOrange"]',
    );
    await pumpkin.focus();
    await page.keyboard.press('Enter');
    await expect(
        page.getByRole('button', { name: /Postavi.*30/u }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Više informacija' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    const back = page.getByRole('button', { name: 'Natrag' });
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(
        page.locator('[data-active-items-picker="Jesen"]'),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Dekoracija', exact: true }).click();
    await page.getByRole('button', { name: 'Ljeto', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'BeachUmbrella' }),
    ).toBeVisible();
});

test('unpublished variants and optional event groups stay out of autumn discovery', async ({
    mount,
    page,
}) => {
    await mount(
        <ItemsHudAlignmentStory
            includeHarvestPumpkins={false}
            includeChestnutRoastingCart={false}
            includePumpkinLanterns={false}
            includeHalloweenAccents={false}
        />,
    );
    await page.getByRole('button', { name: 'Jesen', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Kestenijada', exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Noć bundeva', exact: true }),
    ).toHaveCount(0);
    await page
        .getByRole('button', { name: 'Jesenska berba', exact: true })
        .click();
    await expect(
        page.locator('[data-items-hud-entity^="HarvestPumpkin"]'),
    ).toHaveCount(0);
    await expect(
        page.locator('[data-items-hud-entity="WoodenSign"]'),
    ).toBeVisible();
    const pickerImage = page
        .getByRole('button', { name: 'Jesen', exact: true })
        .getByRole('img');
    await expect(pickerImage).not.toHaveAttribute('src', /HarvestPumpkin/u);
});

test('autumn offers retain the ordinary price, shortage state and exact drag identity', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await mount(<ItemsHudDragStateStory accountSunflowers={40} />);
    await page.getByRole('button', { name: 'Jesen', exact: true }).click();
    await page
        .getByRole('button', { name: 'Jesenska berba', exact: true })
        .click();
    const pumpkin = page.locator(
        '[data-items-hud-entity="HarvestPumpkinSquatOrange"]',
    );
    await pumpkin.click();
    await expect(
        page.getByRole('button', { name: /Postavi.*30/u }),
    ).toBeEnabled();
    await page.keyboard.press('Escape');
    const box = await pumpkin.boundingBox();
    if (!box) throw new Error('Missing pumpkin button');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
        box.x + box.width / 2 + 30,
        box.y + box.height / 2 - 30,
        { steps: 5 },
    );
    await expect(page.getByTestId('hud-placement-drag-state')).toHaveText(
        'HarvestPumpkinSquatOrange:drag',
    );
    await page.mouse.up();
    await expect(page.getByTestId('hud-placement-drag-state')).toHaveText(
        'HarvestPumpkinSquatOrange:drop',
    );
    await page.getByRole('button', { name: 'Natrag' }).click();
    await page
        .getByRole('button', { name: 'Topla večer', exact: true })
        .click();
    await page.locator('[data-items-hud-entity="WickerGardenLantern"]').click();
    await expect(
        page.getByRole('button', { name: /Postavi.*60/u }),
    ).toBeDisabled();
    await expect(
        page.getByText('Nedovoljno suncokreta.', { exact: true }),
    ).toBeVisible();
});

for (const reference of [
    { group: 'Jesenska berba', id: 'harvest-corner' },
    { group: 'Šumski kutak', id: 'woodland-path' },
    { group: 'Topla večer', id: 'evening-seat' },
]) {
    test(`arrangement ${reference.id} has exact lists and fits a small screen`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await mount(<LocalSandboxItemsHudStory />);
        await page.getByRole('button', { name: 'Jesen', exact: true }).click();
        await page
            .getByRole('button', { name: reference.group, exact: true })
            .click();
        const preview = page.locator(
            `[data-autumn-arrangement="${reference.id}"]`,
        );
        const summary = preview.locator('summary');
        await expect(summary).toHaveText('Primjer rasporeda · 2 × 3');
        await summary.focus();
        await page.keyboard.press('Enter');
        await expect(preview).toHaveAttribute('open', '');
        await expect(preview.getByRole('listitem')).toHaveCount(4);
        await expect(
            preview.getByText(
                'Ideja za ručno slaganje. Predmeti se odabiru pojedinačno.',
            ),
        ).toBeVisible();
        await expect(preview.getByText(/Okolina na slici/)).toContainText(
            '16 ×',
        );
        const image = preview.getByRole('img');
        await expect(image).toHaveAttribute(
            'src',
            new RegExp(`${reference.id}\\.png`),
        );
        await expect
            .poll(() =>
                image.evaluate(
                    (node) =>
                        node instanceof HTMLImageElement &&
                        node.complete &&
                        node.naturalWidth > 0,
                ),
            )
            .toBe(true);
        const picker = page.locator(
            `[data-active-items-picker="${reference.group}"]`,
        );
        const box = await picker.boundingBox();
        expect(box?.x).toBeGreaterThanOrEqual(0);
        expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
        expect(
            await picker.evaluate(
                (node) => node.scrollWidth <= node.clientWidth,
            ),
        ).toBe(true);
        await summary.focus();
        await page.keyboard.press('Enter');
        await expect(preview).not.toHaveAttribute('open');
        await expect(
            picker.locator('[data-items-hud-entity]').first(),
        ).toBeVisible();
    });
}

test('arrangement missing a published prop does not load a preview', async ({
    mount,
    page,
}) => {
    const previews: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/assets/arrangements/'))
            previews.push(request.url());
    });
    await mount(<ItemsHudAlignmentStory includeHarvestPumpkins={false} />);
    await page.getByRole('button', { name: 'Jesen', exact: true }).click();
    await page
        .getByRole('button', { name: 'Jesenska berba', exact: true })
        .click();
    await expect(page.locator('[data-autumn-arrangement]')).toHaveCount(0);
    expect(previews).toEqual([]);
});
