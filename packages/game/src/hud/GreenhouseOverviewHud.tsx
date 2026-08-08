import type { OperationData, PlantSortData } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { Divider } from '@gredice/ui/Divider';
import { Home } from '@gredice/ui/icons';
import { Progress } from '@gredice/ui/Progress';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useMemo } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useOperations } from '../hooks/useOperations';
import { useAllSorts } from '../hooks/usePlantSorts';
import { useSnapshotTime } from '../hooks/useSnapshotTime';
import { GameModal } from '../shared-ui/game-modal';
import { ScrollView } from '../shared-ui/ScrollView';
import { HudCard } from './components/HudCard';
import {
    getGreenhouseSeedlingProgressData,
    getGreenhouseSeedlingProgressPercentage,
    isGreenhouseSeedlingField,
    isSeedlingTransplantingOperation,
} from './raisedBed/greenhouseSeedlings';

type CurrentGardenData = NonNullable<
    ReturnType<typeof useCurrentGarden>['data']
>;
type RaisedBedData = CurrentGardenData['raisedBeds'][number];
type RaisedBedFieldData = RaisedBedData['fields'][number];

type GreenhouseOverviewItem = {
    expectedReplantingDate: Date | null;
    field: RaisedBedFieldData;
    plantSort: PlantSortData;
    positionIndex: number;
    progressPercentage: number;
    raisedBedName: string;
    stageLabel: string;
};

const dateFormatter = new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric',
    month: 'short',
});

function greenhouseSeedlingCountLabel(count: number) {
    if (count === 1) {
        return '1 sadnica';
    }

    const lastTwoDigits = count % 100;
    const lastDigit = count % 10;
    if (
        lastDigit >= 2 &&
        lastDigit <= 4 &&
        (lastTwoDigits < 12 || lastTwoDigits > 14)
    ) {
        return `${count.toString()} sadnice`;
    }

    return `${count.toString()} sadnica`;
}

function greenhouseSeedlingStageLabel({
    field,
    progressPercentage,
}: {
    field: RaisedBedFieldData;
    progressPercentage: number;
}) {
    if (field.plantStatus === 'pendingVerification') {
        return 'Čeka potvrdu';
    }
    if (!field.plantSowDate || !field.plantGrowthDate) {
        return 'Klijanje';
    }
    if (field.plantReadyDate || progressPercentage >= 100) {
        return 'Spremno za presađivanje';
    }

    return 'U stakleniku';
}

function buildGreenhouseOverviewItems({
    garden,
    now,
    sorts,
    transplantOperation,
}: {
    garden: CurrentGardenData | null | undefined;
    now: Date;
    sorts: PlantSortData[] | null | undefined;
    transplantOperation: OperationData | null | undefined;
}) {
    if (!garden || !sorts) {
        return [];
    }

    const sortsById = new Map(sorts.map((sort) => [sort.id, sort]));
    const items: GreenhouseOverviewItem[] = [];

    for (const raisedBed of garden.raisedBeds) {
        for (const field of raisedBed.fields) {
            if (!isGreenhouseSeedlingField(field)) {
                continue;
            }

            const plantSortId = field.plantSortId;
            const plantSort =
                typeof plantSortId === 'number'
                    ? sortsById.get(plantSortId)
                    : undefined;

            if (!plantSort) {
                continue;
            }

            const progressData = getGreenhouseSeedlingProgressData({
                field,
                now,
                plantAttributes: plantSort.information.plant.attributes,
                transplantOperation,
            });
            const progressPercentage =
                getGreenhouseSeedlingProgressPercentage(progressData);

            items.push({
                expectedReplantingDate: progressData.expectedReplantingDate,
                field,
                plantSort,
                positionIndex: field.positionIndex,
                progressPercentage,
                raisedBedName: raisedBed.name,
                stageLabel: greenhouseSeedlingStageLabel({
                    field,
                    progressPercentage,
                }),
            });
        }
    }

    return items.sort(
        (left, right) =>
            left.raisedBedName.localeCompare(right.raisedBedName, 'hr') ||
            left.positionIndex - right.positionIndex,
    );
}

export function GreenhouseOverviewHud() {
    const { data: currentGarden } = useCurrentGarden();
    const { data: sorts } = useAllSorts();
    const { data: operations } = useOperations();
    const now = useSnapshotTime();
    const transplantOperation = useMemo(
        () => operations?.find(isSeedlingTransplantingOperation),
        [operations],
    );
    const items = useMemo(
        () =>
            buildGreenhouseOverviewItems({
                garden: currentGarden,
                now,
                sorts,
                transplantOperation,
            }),
        [currentGarden, now, sorts, transplantOperation],
    );

    if (items.length === 0) {
        return null;
    }

    const countLabel = greenhouseSeedlingCountLabel(items.length);
    const headerDescription =
        items.length === 1
            ? `U vrtu je ${countLabel} iz gredica.`
            : `U vrtu su ${countLabel} iz gredica.`;

    return (
        <HudCard
            open
            position="floating"
            className="static p-0.5"
            data-greenhouse-overview-hud
        >
            <GameModal
                title="Staklenik"
                headerIcon={<Home className="size-7 shrink-0" />}
                headerDescription={headerDescription}
                className="md:max-w-2xl"
                hudLayer
                trigger={
                    <Button
                        title="Staklenik"
                        variant="plain"
                        aria-label={`Staklenik: ${countLabel}`}
                        className="relative rounded-full p-2 gap-2"
                    >
                        <Home className="size-6 shrink-0" />
                        <Typography
                            level="body2"
                            semiBold
                            className="text-foreground"
                        >
                            Staklenik
                        </Typography>
                        <span
                            aria-hidden="true"
                            className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full border border-background bg-emerald-600 px-1 text-xs font-semibold leading-5 text-white shadow-xs"
                        >
                            {items.length}
                        </span>
                    </Button>
                }
            >
                <Stack spacing={4} data-greenhouse-overview-panel>
                    <Typography level="body2" secondary>
                        Pregled sadnica koje su posijane za gredice i trenutno
                        su u stakleniku.
                    </Typography>
                    <Divider />
                    <ScrollView
                        className="-mx-2"
                        viewportClassName="max-h-[min(60vh,32rem)]"
                        contentClassName="grid gap-3 px-2 py-1"
                    >
                        {items.map((item) => (
                            <div
                                className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-lg border bg-card p-3"
                                data-greenhouse-overview-item
                                key={`${item.field.id.toString()}-${item.positionIndex.toString()}`}
                            >
                                <div className="relative size-14 overflow-hidden rounded-full border border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/50">
                                    <PlantOrSortImage
                                        plantSort={item.plantSort}
                                        width={56}
                                        height={56}
                                        className="size-full rounded-full object-cover"
                                    />
                                </div>
                                <Stack spacing={2} className="min-w-0">
                                    <Row
                                        justifyContent="space-between"
                                        alignItems="start"
                                        className="min-w-0 gap-3"
                                    >
                                        <Stack
                                            spacing={0.5}
                                            className="min-w-0"
                                        >
                                            <Typography
                                                level="body1"
                                                semiBold
                                                noWrap
                                                title={
                                                    item.plantSort.information
                                                        .name
                                                }
                                            >
                                                {
                                                    item.plantSort.information
                                                        .name
                                                }
                                            </Typography>
                                            <Typography
                                                level="body3"
                                                secondary
                                                noWrap
                                            >
                                                {item.raisedBedName} · Polje{' '}
                                                {item.positionIndex + 1}
                                            </Typography>
                                        </Stack>
                                        <Typography
                                            level="body2"
                                            semiBold
                                            className="shrink-0 tabular-nums text-emerald-700 dark:text-emerald-300"
                                        >
                                            {item.progressPercentage}%
                                        </Typography>
                                    </Row>
                                    <Stack spacing={1}>
                                        <Row
                                            justifyContent="space-between"
                                            className="gap-3"
                                        >
                                            <Typography level="body3" semiBold>
                                                {item.stageLabel}
                                            </Typography>
                                            {item.expectedReplantingDate ? (
                                                <Typography
                                                    level="body3"
                                                    secondary
                                                    className="shrink-0"
                                                >
                                                    Očekivano{' '}
                                                    {dateFormatter.format(
                                                        item.expectedReplantingDate,
                                                    )}
                                                </Typography>
                                            ) : null}
                                        </Row>
                                        <Progress
                                            aria-label={`Napredak sadnice ${item.plantSort.information.name}`}
                                            data-greenhouse-overview-progress
                                            value={item.progressPercentage}
                                            trackClassName="bg-emerald-500"
                                        />
                                    </Stack>
                                </Stack>
                            </div>
                        ))}
                    </ScrollView>
                </Stack>
            </GameModal>
        </HudCard>
    );
}
