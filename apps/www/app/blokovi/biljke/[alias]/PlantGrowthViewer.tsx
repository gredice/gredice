'use client';

import type { PlantData, PlantSortData } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Edit } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useCallback, useState } from 'react';
import { KnownPages } from '../../../../src/KnownPages';
import { PlantBlockImage } from '../../PlantBlockImage';
import { resolvePlantType } from '../../plantNamesWithLSystem';
import { PlantGrowthControls } from './PlantGrowthControls';
import { PlantViewerDynamic } from './PlantViewerDynamic';

const MAX_GENERATION = 12;

function getLifecycleWeeks(plant: PlantData): number {
    const attrs = plant.attributes;
    const totalDays =
        (attrs.germinationWindowMax ?? 0) +
        (attrs.growthWindowMax ?? 0) +
        (attrs.harvestWindowMax ?? 0);
    return Math.max(1, Math.ceil(totalDays / 7));
}

function generationToWeeks(generation: number, totalWeeks: number): number {
    return Math.round((generation / MAX_GENERATION) * totalWeeks);
}

export function PlantGrowthViewer({
    plant,
    sorts,
}: {
    plant: PlantData;
    sorts: PlantSortData[];
}) {
    const plantType = resolvePlantType(plant.information.name);
    const [generation, setGeneration] = useState(MAX_GENERATION * 0.9);
    const [selectedSortId, setSelectedSortId] = useState<number | null>(
        sorts.length > 0 ? sorts[0].id : null,
    );

    const selectedSort = sorts.find((s) => s.id === selectedSortId) ?? null;
    const totalWeeks = getLifecycleWeeks(plant);
    const currentWeeks = generationToWeeks(generation, totalWeeks);

    const handleSliderChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setGeneration(Number.parseFloat(e.target.value));
        },
        [],
    );

    if (!plantType) {
        return (
            <Typography level="body1" secondary>
                3D prikaz nije dostupan za ovu biljku.
            </Typography>
        );
    }

    const seed = selectedSort ? `sort-${selectedSort.id}` : `plant-${plant.id}`;

    return (
        <div className="grid grid-cols-[2fr_1fr] gap-4">
            <Card className="border-tertiary border-b-4 overflow-hidden">
                <CardOverflow>
                    <div className="h-[400px] md:h-[500px]">
                        <PlantViewerDynamic
                            plantType={plantType}
                            generation={generation}
                            seed={seed}
                            className="h-full w-full"
                        />
                    </div>
                </CardOverflow>
            </Card>
            <Stack spacing={8}>
                <Row spacing={4} alignItems="start">
                    <Card className="shrink-0">
                        <CardOverflow>
                            <PlantBlockImage
                                plantName={plant.information.name}
                                width={80}
                                height={80}
                            />
                        </CardOverflow>
                    </Card>
                    <Stack spacing={2}>
                        <Typography level="h4" component="h1">
                            {plant.information.name}
                        </Typography>
                        <Typography level="body2">
                            {plant.information.description}
                        </Typography>
                    </Stack>
                </Row>
                <PlantGrowthControls
                    currentWeeks={currentWeeks}
                    totalWeeks={totalWeeks}
                    generation={generation}
                    maxGeneration={MAX_GENERATION}
                    onSliderChange={handleSliderChange}
                />
                {sorts.length > 0 && (
                    <Stack spacing={2}>
                        <Typography level="h5">Sorta</Typography>
                        <div className="flex flex-wrap gap-2">
                            {sorts.map((sort) => (
                                <Button
                                    key={sort.id}
                                    onClick={() => setSelectedSortId(sort.id)}
                                    className={cx(
                                        selectedSortId === sort.id
                                            ? 'border-green-600 bg-green-50 dark:bg-green-800 text-green-800 dark:text-green-200'
                                            : 'hover:border-green-400',
                                    )}
                                >
                                    {sort.information.name}
                                </Button>
                            ))}
                        </div>
                    </Stack>
                )}
                <Button
                    className="w-fit"
                    startDecorator={<Edit />}
                    href={`${KnownPages.BlockPlantGenerator}?plant=${plantType}`}
                >
                    Uredi biljku
                </Button>
            </Stack>
        </div>
    );
}
