import { Chip } from '@gredice/ui/Chip';
import { Row } from '@gredice/ui/Row';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import type { RaisedBedFieldPlantHistoryEntry } from '../../utils/raisedBedFields';
import { PlantStageSection } from './PlantStageSection';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type PlantLifecycleAttributes = {
    germinationWindowMin?: number | null;
    germinationWindowMax?: number | null;
    growthWindowMin?: number | null;
    growthWindowMax?: number | null;
    harvestWindowMin?: number | null;
    harvestWindowMax?: number | null;
};

export type PlantLifecycleProgressData = {
    germinationValue: number;
    germinationPercentage: number;
    germinatingDays: number;
    growthValue: number;
    growthPercentage: number;
    growingDays: number;
    harvestValue: number;
    harvestPercentage: number;
    readyDays: number;
};

const plantStageDescriptions = {
    germination:
        'Klijanje je razdoblje od sijanja do trenutka kada sjeme proklija i biljka krene iz zemlje.',
    growth: 'Rast je razdoblje nakon klijanja u kojem biljka razvija korijen, stabljiku i listove te se priprema za berbu.',
    harvest:
        'Berba znači da biljka ima plodove ili drugi prinos, od mladog do zrelijeg, koji se može brati.',
} as const;

export function getPlantLifecycleProgressData({
    field,
    plantAttributes,
    now = new Date(),
}: {
    field: RaisedBedFieldPlantHistoryEntry | null | undefined;
    plantAttributes: PlantLifecycleAttributes | null | undefined;
    now?: Date;
}): PlantLifecycleProgressData {
    const result = {
        germinationValue: 0,
        germinationPercentage: 0,
        germinatingDays: 0,
        growthValue: 0,
        growthPercentage: 0,
        growingDays: 0,
        harvestValue: 0,
        harvestPercentage: 0,
        readyDays: 0,
    };

    if (!field) {
        return result;
    }

    const targetDateNow = (
        field.stoppedDate ? new Date(field.stoppedDate) : now
    ).getTime();

    const maxDuration =
        (plantAttributes?.germinationWindowMax ?? 0) +
        (plantAttributes?.growthWindowMax ?? 0) +
        (plantAttributes?.harvestWindowMax ?? 0);
    result.germinationPercentage = plantAttributes?.germinationWindowMax
        ? Math.max(
              10,
              Math.min(
                  100,
                  (plantAttributes.germinationWindowMax / (maxDuration ?? 0)) *
                      100,
              ),
          )
        : 0;
    result.harvestPercentage = plantAttributes?.harvestWindowMax
        ? Math.min(
              100,
              (plantAttributes.harvestWindowMax / (maxDuration ?? 0)) * 100,
          )
        : 0;

    const germinationWindowMs =
        (plantAttributes?.germinationWindowMax ?? 0) * MS_PER_DAY;
    result.germinationValue = field.plantGrowthDate
        ? 100
        : field.plantSowDate
          ? Math.min(
                100,
                ((targetDateNow - new Date(field.plantSowDate).getTime()) /
                    (germinationWindowMs || 1)) *
                    100,
            )
          : 0;
    result.germinatingDays = Math.round(
        ((field.plantGrowthDate
            ? new Date(field.plantGrowthDate).getTime()
            : targetDateNow) -
            (field.plantSowDate
                ? new Date(field.plantSowDate).getTime()
                : targetDateNow)) /
            MS_PER_DAY,
    );

    result.growthPercentage =
        100 - result.germinationPercentage - result.harvestPercentage;
    const growthWindowMs = (plantAttributes?.growthWindowMax ?? 0) * MS_PER_DAY;
    result.growthValue = field.plantReadyDate
        ? 100
        : field.plantGrowthDate
          ? Math.min(
                100,
                ((targetDateNow - new Date(field.plantGrowthDate).getTime()) /
                    (growthWindowMs || 1)) *
                    100,
            )
          : 0;
    result.growingDays = Math.round(
        ((field.plantReadyDate
            ? new Date(field.plantReadyDate).getTime()
            : targetDateNow) -
            (field.plantGrowthDate
                ? new Date(field.plantGrowthDate).getTime()
                : targetDateNow)) /
            MS_PER_DAY,
    );

    const harvestWindowMs =
        (plantAttributes?.harvestWindowMax ?? 0) * MS_PER_DAY;
    const harvestElapsedMs = field.plantReadyDate
        ? Math.abs(targetDateNow - new Date(field.plantReadyDate).getTime())
        : 0;
    result.harvestValue = field.plantReadyDate
        ? Math.min(100, (harvestElapsedMs / (harvestWindowMs || 1)) * 100)
        : 0;
    result.readyDays = Math.round(harvestElapsedMs / MS_PER_DAY);

    return result;
}

export function PlantLifecycleProgress({
    field,
    plantAttributes,
    lifecycleData,
    plantDetailsUrl,
    statusTrigger,
}: {
    field: RaisedBedFieldPlantHistoryEntry;
    plantAttributes: PlantLifecycleAttributes | null | undefined;
    lifecycleData: PlantLifecycleProgressData;
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
    const growingDaysDayPlural =
        lifecycleData.growingDays === 1 ? 'dan' : 'dana';
    const readyDaysDayPlural = lifecycleData.readyDays === 1 ? 'dan' : 'dana';

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
                      value: lifecycleData.growthValue,
                      percentage: lifecycleData.growthPercentage,
                      color: 'stroke-green-500',
                      trackColor: 'stroke-green-200 dark:stroke-green-50',
                      pulse: !field.plantReadyDate,
                      borderColor: 'stroke-green-500',
                  },
                  {
                      value: lifecycleData.harvestValue,
                      percentage: lifecycleData.harvestPercentage,
                      color: 'stroke-blue-500',
                      trackColor: 'stroke-blue-200 dark:stroke-blue-50',
                      pulse: Boolean(lifecycleData.harvestValue),
                      borderColor: 'stroke-blue-500',
                  },
              ];

    return (
        <>
            {shouldShowPlantScheduledDate && (
                <Row spacing={2}>
                    <Typography level="body2">Planirani datum</Typography>
                    <div className="flex items-start">
                        <Chip>
                            {plantScheduledDate?.toLocaleDateString('hr-HR') ||
                                'Nepoznato'}
                        </Chip>
                    </div>
                </Row>
            )}
            <Row spacing={2}>
                <SegmentedCircularProgress
                    size={140}
                    strokeWidth={3}
                    segments={segments}
                >
                    {statusTrigger}
                </SegmentedCircularProgress>
                <Stack spacing={0.75}>
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
                        stageDescription={plantStageDescriptions.germination}
                        plantDetailsUrl={plantDetailsUrl}
                    />
                    <PlantStageSection
                        label="Rast"
                        legendColorClass="bg-green-500"
                        legendBorderColorClass="border-green-500"
                        legendPulse={
                            Boolean(field.plantGrowthDate) &&
                            !field.plantReadyDate
                        }
                        legendFilled={Boolean(field.plantReadyDate)}
                        windowMin={plantAttributes?.growthWindowMin}
                        windowMax={plantAttributes?.growthWindowMax}
                        startDate={
                            field.plantGrowthDate
                                ? new Date(field.plantGrowthDate)
                                : null
                        }
                        endDate={
                            field.plantReadyDate
                                ? new Date(field.plantReadyDate)
                                : field.stoppedDate
                                  ? new Date(field.stoppedDate)
                                  : null
                        }
                        daysCount={lifecycleData.growingDays}
                        dayPlural={growingDaysDayPlural}
                        fallbackText="Nije u fazi rasta"
                        stageDescription={plantStageDescriptions.growth}
                        plantDetailsUrl={plantDetailsUrl}
                    />
                    <PlantStageSection
                        label="Berba"
                        legendColorClass="bg-blue-500"
                        legendBorderColorClass="border-blue-500"
                        legendPulse={
                            Boolean(field.plantReadyDate) &&
                            lifecycleData.harvestValue > 0 &&
                            lifecycleData.harvestValue < 100
                        }
                        legendFilled={Boolean(
                            field.plantStatus === 'harvested' ||
                                lifecycleData.harvestValue >= 100,
                        )}
                        windowMin={plantAttributes?.harvestWindowMin}
                        windowMax={plantAttributes?.harvestWindowMax}
                        startDate={
                            field.plantReadyDate
                                ? new Date(field.plantReadyDate)
                                : null
                        }
                        daysCount={lifecycleData.readyDays}
                        dayPlural={readyDaysDayPlural}
                        fallbackText="Nije u fazi berbe"
                        stageDescription={plantStageDescriptions.harvest}
                        plantDetailsUrl={plantDetailsUrl}
                        variant="single"
                    />
                </Stack>
            </Row>
        </>
    );
}
