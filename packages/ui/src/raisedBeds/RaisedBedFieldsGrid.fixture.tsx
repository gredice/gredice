import type { RaisedBedAddon } from '@gredice/js/operations';
import { getRaisedBedFieldGroups } from '@gredice/js/plants';
import {
    RaisedBedAddons,
    RaisedBedFieldsGrid,
    RaisedBedPlantDetails,
    RaisedBedPlantItem,
} from '@gredice/ui/raisedBeds';
import { Button } from '../Button';

const plants = [
    { name: 'Rajčica saint pierre', positionNumbers: [8] },
    {
        name: 'Matovilac verte de cambrai',
        positionNumbers: [8],
        plantCount: 16,
        spacingCm: 7.5,
        layout: { plantsPerAxis: 4, spanRows: 1, spanColumns: 1 },
    },
    {
        name: 'Tikvica zelena',
        positionNumbers: [4, 5, 7, 8],
        plantCount: 1,
        spacingCm: 60,
        layout: { plantsPerAxis: 1, spanRows: 2, spanColumns: 2 },
    },
];

export const raisedBedAddonFixture: RaisedBedAddon[] = [
    {
        family: 'mulch',
        label: 'Malčiranje slamom',
        operationId: 1,
        appliedAt: '2026-09-02T08:00:00Z',
        pendingVerification: false,
        scope: 'raisedBed',
        positionNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    {
        family: 'supports',
        label: 'Postavljanje potpornja i vezanje',
        operationId: 2,
        appliedAt: '2026-09-03T08:00:00Z',
        pendingVerification: true,
        scope: 'field',
        positionNumbers: [8],
    },
];

export function RaisedBedFieldsGridFixture() {
    const groups = getRaisedBedFieldGroups([8, 7, 6, 5, 4, 3, 2, 1, 0], plants);
    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
            <div className="mb-3">
                <RaisedBedAddons
                    addons={raisedBedAddonFixture}
                    fieldCount={9}
                />
            </div>
            <RaisedBedFieldsGrid
                groups={groups.map((group) => ({
                    ...group,
                    fields: group.positionNumbers.map((position) => ({
                        position,
                        addons: (
                            <RaisedBedAddons
                                addons={raisedBedAddonFixture}
                                position={position}
                                fieldCount={9}
                            />
                        ),
                        controls: (
                            <Button
                                size="sm"
                                variant="plain"
                                aria-label={`Korov na polju ${position}`}
                            >
                                Korov
                            </Button>
                        ),
                    })),
                    children: plants
                        .filter((plant) =>
                            plant.positionNumbers.some((position) =>
                                group.positionNumbers.includes(position),
                            ),
                        )
                        .map((plant) => (
                            <RaisedBedPlantItem
                                key={plant.name}
                                {...plant}
                                statusControl={
                                    <Button size="sm" variant="outlined">
                                        Posijana
                                    </Button>
                                }
                                locationControl={<span>Gredica</span>}
                                details={
                                    <RaisedBedPlantDetails
                                        {...plant}
                                        dates={[
                                            {
                                                label: 'Početak sadnje',
                                                value: '2026-08-15T04:15:00Z',
                                            },
                                        ]}
                                    />
                                }
                            />
                        )),
                }))}
            />
        </div>
    );
}
