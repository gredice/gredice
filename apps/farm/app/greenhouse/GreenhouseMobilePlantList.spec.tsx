import { expect, test } from '@playwright/experimental-ct-react';
import '../globals.css';
import { Card } from '@gredice/ui/Card';
import { GreenhouseMobilePlantList } from './GreenhouseMobilePlantList';

const phoneViewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 430, height: 932 },
] as const;

const longPlantName = 'Paprika žuta slatka vrlo dugog naziva';

function greenhouseList() {
    return (
        <div className="p-4">
            <Card>
                <GreenhouseMobilePlantList
                    items={[
                        {
                            germinationDate: '03. 07. 2026.',
                            key: 'field-5',
                            plantName: longPlantName,
                            plantSort: undefined,
                            positionNumber: 5,
                            sowingDate: (
                                <div className="space-y-0.5">
                                    <span>25. 06. 2026.</span>
                                    <div className="text-sm text-muted-foreground">
                                        8 dana do klijanja
                                    </div>
                                </div>
                            ),
                            statusColor: 'success',
                            statusEmoji: '🌱',
                            statusLabel: 'Proklijalo',
                        },
                    ]}
                />
            </Card>
        </div>
    );
}

for (const viewport of phoneViewports) {
    test(`keeps greenhouse seedling details readable at ${viewport.width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize(viewport);
        const component = await mount(greenhouseList());

        await expect(component.getByText('Polje 5')).toBeVisible();
        await expect(component.getByText(longPlantName)).toBeVisible();
        await expect(component.getByText('Proklijalo')).toHaveCount(2);
        await expect(component.getByText('Posijano')).toBeVisible();
        await expect(component.getByText('8 dana do klijanja')).toBeVisible();

        const plantNameWidth = await component
            .locator('[data-greenhouse-plant-name]')
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

test('hides the mobile list at the desktop table breakpoint', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const component = await mount(greenhouseList());

    await expect(
        component.locator('[data-greenhouse-mobile-list]'),
    ).toBeHidden();
});
