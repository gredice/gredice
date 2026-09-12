import { getRaisedBedFieldGroups } from '@gredice/js/plants';
import {
    RaisedBedFieldsGrid,
    RaisedBedPlantDetails,
    RaisedBedPlantItem,
} from '@gredice/ui/raisedBeds';
import { Button } from '../Button';
import { Chip } from '../Chip';
import { GamePlantStatusIcon } from '../GameIcons';

const plants = [
    { name: 'Rajčica saint pierre', positionNumbers: [8] },
    { name: 'Kupus bijeli futoški domaći', positionNumbers: [1] },
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

export function RaisedBedFieldsGridFixture({
    compact = false,
}: {
    compact?: boolean;
}) {
    const groups = getRaisedBedFieldGroups([8, 7, 6, 5, 4, 3, 2, 1, 0], plants);
    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: 16 }}>
            <RaisedBedFieldsGrid
                compact={compact}
                groups={groups.map((group) => ({
                    ...group,
                    fields: group.positionNumbers.map((position) => ({
                        position,
                        controls: compact ? (
                            plants
                                .filter(
                                    (plant) =>
                                        plant.positionNumbers[0] === position,
                                )
                                .map((plant) => (
                                    <RaisedBedPlantDetails
                                        key={plant.name}
                                        {...plant}
                                        sowingDate="2026-08-15T04:15:00Z"
                                        dates={[
                                            {
                                                label: 'Posijano',
                                                value: '2026-08-15T04:15:00Z',
                                            },
                                        ]}
                                    />
                                ))
                        ) : (
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
                                compact={compact}
                                showPositionLabel={
                                    !compact || group.positionNumbers.length > 1
                                }
                                statusControl={
                                    <Chip
                                        size="sm"
                                        variant="outlined"
                                        className="whitespace-normal"
                                        startDecorator={
                                            <GamePlantStatusIcon
                                                status="sowed"
                                                className="size-5!"
                                                aria-hidden
                                            />
                                        }
                                    >
                                        Posijana
                                    </Chip>
                                }
                                locationControl={
                                    <Chip size="sm" variant="outlined">
                                        Gredica
                                    </Chip>
                                }
                                details={
                                    !compact && (
                                        <RaisedBedPlantDetails
                                            {...plant}
                                            dates={[
                                                {
                                                    label: 'Početak sadnje',
                                                    value: '2026-08-15T04:15:00Z',
                                                },
                                            ]}
                                        />
                                    )
                                }
                            />
                        )),
                }))}
            />
        </div>
    );
}
