import { expect, test } from '@playwright/experimental-ct-react';
import '../globals.css';
import {
    FarmScheduleSelectedPlantingTaskCard,
    type FarmScheduleSelectedPlantingTaskCardPlanting,
} from './FarmScheduleSelectedPlantingTaskCard';
import { buildFarmScheduleSelectedPlantingLabel } from './schedulePlantingPresentation';

const planting = {
    configurationSource: 'selected',
    id: 71,
    selectedTask: {
        assignedUserIds: [],
        block: null,
        identity: {
            expectedLifecycleVersionEventId: 901,
            expectedPlantSortId: 501,
            kind: 'selected',
            plantingId: 71,
        },
        scheduledDate: '2026-08-10',
        sowingLocation: 'direct',
        status: 'planned',
    },
} satisfies FarmScheduleSelectedPlantingTaskCardPlanting;

test('renders one logical 2 by 2 planting with all membership fields and five minutes', async ({
    mount,
}) => {
    const component = await mount(
        <FarmScheduleSelectedPlantingTaskCard
            label={buildFarmScheduleSelectedPlantingLabel({
                plantCount: 1,
                plantName: 'Tikvica',
                plantsPerAxis: 1,
                selectedSeedingDistanceCm: 60,
                sowingLocation: 'direct',
                spanColumns: 2,
                spanRows: 2,
            })}
            physicalPositionNumbers={[1, 2, 4, 5]}
            planting={planting}
            plantSort={{ id: 501, information: { name: 'Tikvica' } }}
            raisedBedLabel="Gredica 10"
            userId="farmer-1"
        />,
    );

    await expect(component).toHaveAttribute(
        'data-selected-planting-task-id',
        '71',
    );
    await expect(
        component.getByText(
            'Sijanje: Tikvica · 2 × 2 polja · gustoća 1 × 1 · ukupno 1 biljka · razmak 60 cm',
        ),
    ).toBeVisible();
    await expect(component.getByText('Polja 1, 2, 4, 5')).toBeVisible();
    await expect(component.getByText('5 min')).toBeVisible();
    await expect(component.getByText('Nije dodijeljeno')).toBeVisible();
});
