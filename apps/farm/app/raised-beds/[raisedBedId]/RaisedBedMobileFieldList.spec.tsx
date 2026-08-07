import { Card } from '@gredice/ui/Card';
import { expect, test } from '@playwright/experimental-ct-react';
import '../../globals.css';
import { RaisedBedMobileFieldList } from './RaisedBedMobileFieldList';

const phoneViewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 430, height: 932 },
] as const;

const longPlantName = 'Krastavac dugi zeleni Long Anglais';

function mobileFieldList() {
    return (
        <div className="p-4">
            <Card>
                <RaisedBedMobileFieldList
                    items={[
                        {
                            harvestedDate: '—',
                            key: 'position-1',
                            plannedDate: '01. 05. 2026.',
                            plantName: longPlantName,
                            plantSort: null,
                            positionNumber: 1,
                            readyDate: '09. 06. 2026.',
                            sowingDate: '22. 05. 2026.',
                            statusControl: (
                                <button type="button">🌱 Proklijala</button>
                            ),
                        },
                    ]}
                />
            </Card>
        </div>
    );
}

for (const viewport of phoneViewports) {
    test(`keeps raised-bed field details readable at ${viewport.width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize(viewport);
        const component = await mount(mobileFieldList());

        await expect(component.getByText('Pozicija 1')).toBeVisible();
        await expect(component.getByText(longPlantName)).toBeVisible();
        await expect(
            component.getByRole('button', { name: '🌱 Proklijala' }),
        ).toBeVisible();
        await expect(component.getByText('Planirano')).toBeVisible();
        await expect(component.getByText('Posijano')).toBeVisible();
        await expect(component.getByText('Spremno')).toBeVisible();
        await expect(component.getByText('Ubrano')).toBeVisible();

        const plantNameWidth = await component
            .locator('[data-raised-bed-plant-name]')
            .evaluate((element) => element.getBoundingClientRect().width);
        expect(plantNameWidth).toBeGreaterThan(100);
        expect(
            await page.evaluate(
                () =>
                    document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth,
            ),
        ).toBe(true);
    });
}

test('hides the raised-bed mobile list at the desktop breakpoint', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const component = await mount(mobileFieldList());

    await expect(
        component.locator('[data-raised-bed-mobile-list]'),
    ).toBeHidden();
});
