import type { RaisedBedPlantingReadModel } from '@gredice/js/plants';
import { RaisedBedPlantingsReadOnly } from '@gredice/ui/raisedBeds';
import { expect, test } from '@playwright/experimental-ct-react';

function item(
    overrides: Partial<RaisedBedPlantingReadModel> = {},
): RaisedBedPlantingReadModel & { plantName: string } {
    return {
        configurationSource: 'selected',
        id: 901,
        isActive: true,
        layoutStatus: 'selected',
        lifecycleStartedAt: '2026-08-01T08:00:00.000Z',
        lifecycleStoppedAt: null,
        plantCount: 1,
        plantName: 'Tikvica',
        plantSortId: 42,
        plantsPerAxis: 1,
        positionNumbers: [1, 2, 4, 5],
        selectedSeedingDistanceCm: 60,
        spanColumns: 2,
        spanRows: 2,
        ...overrides,
    };
}

test('renders a multi-field planting once with its stored snapshots', async ({
    mount,
}) => {
    const component = await mount(
        <RaisedBedPlantingsReadOnly items={[item()]} />,
    );

    await expect(
        component.locator('[data-raised-bed-planting-id="901"]'),
    ).toHaveCount(1);
    await expect(component.getByText('60 cm')).toBeVisible();
    await expect(component.getByText('1 × 1 (1 biljka)')).toBeVisible();
    await expect(component.getByText('2 × 2 polja')).toBeVisible();
    await expect(component.getByText('1, 2, 4, 5')).toBeVisible();
});

test('uses the Croatian plural form for a four-plant density', async ({
    mount,
}) => {
    const component = await mount(
        <RaisedBedPlantingsReadOnly
            items={[
                item({
                    plantCount: 4,
                    plantsPerAxis: 2,
                    positionNumbers: [1],
                    selectedSeedingDistanceCm: 15,
                    spanColumns: 1,
                    spanRows: 1,
                }),
            ]}
        />,
    );

    await expect(component.getByText('2 × 2 (4 biljke)')).toBeVisible();
});

test('marks legacy density and footprint unknown', async ({ mount }) => {
    const component = await mount(
        <RaisedBedPlantingsReadOnly
            items={[
                item({
                    configurationSource: 'legacy',
                    layoutStatus: 'legacy-unknown',
                    plantCount: null,
                    plantsPerAxis: null,
                    positionNumbers: [3],
                    selectedSeedingDistanceCm: null,
                    spanColumns: null,
                    spanRows: null,
                }),
            ]}
        />,
    );

    await expect(
        component.getByText(
            /Naslijeđena sadnja: raspored, gustoća i broj biljaka nisu zabilježeni\./u,
        ),
    ).toBeVisible();
    await expect(component.getByText('Odabrani razmak')).toHaveCount(0);
});
