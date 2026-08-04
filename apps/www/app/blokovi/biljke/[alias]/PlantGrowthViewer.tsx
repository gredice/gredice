'use client';

import type { PlantData, PlantSortData } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Edit, Reset } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useCallback, useState } from 'react';
import { KnownPages } from '../../../../src/KnownPages';
import { PlantBlockImage } from '../../PlantBlockImage';
import { resolveProceduralPlantType } from '../../plantNamesWithProceduralModels';
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
    const plantType = resolveProceduralPlantType(plant.information.name);
    const [generation, setGeneration] = useState(MAX_GENERATION * 0.9);
    const [hasInteractedWithViewer, setHasInteractedWithViewer] =
        useState(false);
    const [viewerResetKey, setViewerResetKey] = useState(0);
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

    const handleViewerReset = useCallback(() => {
        setViewerResetKey((currentKey) => currentKey + 1);
        setHasInteractedWithViewer(false);
    }, []);

    if (!plantType) {
        return (
            <Typography level="body1" secondary>
                3D prikaz nije dostupan za ovu biljku.
            </Typography>
        );
    }

    const seed = selectedSort ? `sort-${selectedSort.id}` : `plant-${plant.id}`;

    return (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
            <Card className="w-full self-start overflow-hidden border-tertiary border-b-4">
                <CardOverflow className="relative">
                    <section
                        aria-label={`Interaktivni 3D prikaz biljke ${plant.information.name}`}
                        className="relative h-[360px] w-full sm:aspect-[8/5] sm:h-auto sm:max-h-[500px]"
                        onPointerDown={() => setHasInteractedWithViewer(true)}
                    >
                        <PlantViewerDynamic
                            key={viewerResetKey}
                            plantType={plantType}
                            generation={generation}
                            seed={seed}
                            className="h-full w-full"
                        />
                        <Button
                            aria-label="Vrati 3D prikaz na početni položaj"
                            className="absolute top-3 right-3 size-11 p-0 shadow-sm backdrop-blur-sm"
                            color="neutral"
                            onClick={handleViewerReset}
                            size="lg"
                            title="Vrati prikaz"
                            type="button"
                            variant="soft"
                        >
                            <Reset aria-hidden className="size-4" />
                        </Button>
                        {!hasInteractedWithViewer && (
                            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
                                <Typography
                                    className="rounded-full border bg-background/90 px-3 py-1.5 text-center shadow-sm backdrop-blur-sm"
                                    level="body3"
                                    secondary
                                >
                                    Povuci za okretanje · zumiraj prstima ili
                                    kotačićem
                                </Typography>
                            </div>
                        )}
                    </section>
                </CardOverflow>
            </Card>
            <Stack spacing={6}>
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
                        <Typography
                            component="h2"
                            id="plant-sort-options"
                            level="h5"
                        >
                            Sorta
                        </Typography>
                        <fieldset
                            aria-labelledby="plant-sort-options"
                            className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0"
                        >
                            {sorts.map((sort) => (
                                <Button
                                    aria-pressed={selectedSortId === sort.id}
                                    key={sort.id}
                                    onClick={() => setSelectedSortId(sort.id)}
                                    size="sm"
                                    type="button"
                                    variant={
                                        selectedSortId === sort.id
                                            ? 'soft'
                                            : 'outlined'
                                    }
                                    color={
                                        selectedSortId === sort.id
                                            ? 'success'
                                            : 'neutral'
                                    }
                                    className={cx(
                                        selectedSortId === sort.id
                                            ? 'ring-1 ring-green-600/30'
                                            : 'hover:border-green-400 hover:bg-green-50/60 dark:hover:bg-green-950/30',
                                    )}
                                >
                                    {sort.information.name}
                                </Button>
                            ))}
                        </fieldset>
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
