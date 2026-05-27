import { Chip } from '@gredice/ui/Chip';
import { Home } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import type { RaisedBedFieldPlantHistoryEntry } from '../../utils/raisedBedFields';
import type { GreenhouseSeedlingProgressData } from './greenhouseSeedlings';
import type { PlantLifecycleAttributes } from './PlantLifecycleProgress';
import { PlantStageSection } from './PlantStageSection';

const greenhouseStageDescriptions = {
    germination:
        'Klijanje je razdoblje od sijanja do trenutka kada sjeme proklija i sadnica krene rasti.',
    replanting:
        'Razdoblje nakon klijanja u kojem sadnica ostaje u stakleniku i priprema se za presađivanje na otvoreno.',
} as const;

export function GreenhouseSeedlingProgress({
    field,
    lifecycleData,
    plantAttributes,
    plantDetailsUrl,
    statusTrigger,
}: {
    field: RaisedBedFieldPlantHistoryEntry;
    lifecycleData: GreenhouseSeedlingProgressData;
    plantAttributes: PlantLifecycleAttributes | null | undefined;
    plantDetailsUrl?: string;
    statusTrigger: ReactNode;
}) {
    const plantScheduledDate = field.plantScheduledDate
        ? new Date(field.plantScheduledDate)
        : null;
    const shouldShowPlantScheduledDate =
        Boolean(plantScheduledDate) &&
        !field.plantSowDate &&
        (!field.plantStatus ||
            field.plantStatus === 'new' ||
            field.plantStatus === 'planned');

    const germinatingDaysDayPlural =
        lifecycleData.germinatingDays === 1 ? 'dan' : 'dana';
    const seedlingDaysDayPlural =
        lifecycleData.seedlingDays === 1 ? 'dan' : 'dana';
    const seedlingEndDate = field.plantReadyDate
        ? new Date(field.plantReadyDate)
        : lifecycleData.expectedReplantingDate;
    const segments =
        field.toBeRemoved || field.plantDeadDate
            ? [
                  {
                      value: 100,
                      percentage: 100,
                      color: 'stroke-red-500',
                      trackColor: 'stroke-red-50 dark:stroke-red-50/80',
                      borderColor: 'stroke-red-500',
                  },
              ]
            : [
                  {
                      value: lifecycleData.germinationValue,
                      percentage: lifecycleData.germinationPercentage,
                      color: 'stroke-yellow-500',
                      trackColor: 'stroke-yellow-200 dark:stroke-yellow-50',
                      pulse: !field.plantGrowthDate,
                      borderColor: 'stroke-yellow-500',
                  },
                  {
                      value: lifecycleData.seedlingValue,
                      percentage: lifecycleData.seedlingPercentage,
                      color: 'stroke-emerald-500',
                      trackColor: 'stroke-emerald-200 dark:stroke-emerald-50',
                      pulse:
                          Boolean(field.plantGrowthDate) &&
                          lifecycleData.seedlingValue < 100,
                      borderColor: 'stroke-emerald-500',
                  },
              ];

    return (
        <>
            {shouldShowPlantScheduledDate && (
                <Row spacing={4}>
                    <Typography level="body2">Planirani datum</Typography>
                    <div className="flex items-start">
                        <Chip>
                            {plantScheduledDate?.toLocaleDateString('hr-HR') ||
                                'Nepoznato'}
                        </Chip>
                    </div>
                </Row>
            )}
            <Row
                spacing={2}
                alignItems="center"
                className="rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50"
            >
                <Home className="size-4 shrink-0" aria-hidden="true" />
                <Typography level="body2" semiBold>
                    Sadnica je u stakleniku
                </Typography>
            </Row>
            <Row spacing={4}>
                <div data-greenhouse-seedling-progress>
                    <SegmentedCircularProgress
                        size={140}
                        strokeWidth={3}
                        segments={segments}
                    >
                        {statusTrigger}
                    </SegmentedCircularProgress>
                </div>
                <Stack spacing={1.5}>
                    <PlantStageSection
                        label="Klijanje"
                        legendColorClass="bg-yellow-500"
                        legendBorderColorClass="border-yellow-500"
                        legendPulse={
                            Boolean(field.plantSowDate) &&
                            !field.plantGrowthDate
                        }
                        legendFilled={Boolean(field.plantGrowthDate)}
                        windowMin={plantAttributes?.germinationWindowMin}
                        windowMax={plantAttributes?.germinationWindowMax}
                        startDate={
                            field.plantSowDate
                                ? new Date(field.plantSowDate)
                                : null
                        }
                        endDate={
                            field.plantGrowthDate
                                ? new Date(field.plantGrowthDate)
                                : field.stoppedDate
                                  ? new Date(field.stoppedDate)
                                  : null
                        }
                        daysCount={lifecycleData.germinatingDays}
                        dayPlural={germinatingDaysDayPlural}
                        fallbackText="Nije posijano"
                        stageDescription={
                            greenhouseStageDescriptions.germination
                        }
                        plantDetailsUrl={plantDetailsUrl}
                    />
                    <PlantStageSection
                        label="Presađivanje"
                        legendColorClass="bg-emerald-500"
                        legendBorderColorClass="border-emerald-500"
                        legendPulse={
                            Boolean(field.plantGrowthDate) &&
                            lifecycleData.seedlingValue < 100
                        }
                        legendFilled={lifecycleData.seedlingValue >= 100}
                        windowMin={lifecycleData.replantingWindowDays}
                        windowMax={lifecycleData.replantingWindowDays}
                        startDate={
                            field.plantGrowthDate
                                ? new Date(field.plantGrowthDate)
                                : null
                        }
                        endDate={seedlingEndDate}
                        daysCount={lifecycleData.seedlingDays}
                        dayPlural={seedlingDaysDayPlural}
                        fallbackText="Nije proklijalo"
                        stageDescription={
                            greenhouseStageDescriptions.replanting
                        }
                        plantDetailsUrl={plantDetailsUrl}
                    />
                </Stack>
            </Row>
        </>
    );
}
