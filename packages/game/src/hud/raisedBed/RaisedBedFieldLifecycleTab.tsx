import { plantFieldStatusLabel } from '@gredice/js/plants';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { useRaisedBedFieldRemove } from '../../hooks/useRaisedBedFieldRemove';
import { ShovelIcon } from '../../icons/Shovel';
import type { PlantFieldStatus } from './featuredOperations';
import { PlantStageSection } from './PlantStageSection';
import { RecommendationsCard } from './RecommendationsCard';

// TODO: Move to a separate file
export function useRaisedBedFieldLifecycleData(
    raisedBedId: number,
    positionIndex: number,
) {
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
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const field = raisedBed?.fields.find(
        (field) => field.positionIndex === positionIndex && field.active,
    );
    const plantSortId = field?.plantSortId;
    const { data: plantSort } = usePlantSort(plantSortId);
    if (!raisedBed || !field || !plantSort) {
        return result;
    }

    const targetDateNow = (
        field.stoppedDate ? new Date(field.stoppedDate) : new Date()
    ).getTime();

    const maxDuration =
        (plantSort.information.plant.attributes?.germinationWindowMax ?? 0) +
        (plantSort.information.plant.attributes?.growthWindowMax ?? 0) +
        (plantSort.information.plant.attributes?.harvestWindowMax ?? 0);
    result.germinationPercentage = plantSort.information.plant.attributes
        ?.germinationWindowMax
        ? Math.max(
              10,
              Math.min(
                  100,
                  (plantSort.information.plant.attributes.germinationWindowMax /
                      (maxDuration ?? 0)) *
                      100,
              ),
          )
        : 0;
    result.harvestPercentage = plantSort.information.plant.attributes
        ?.harvestWindowMax
        ? Math.min(
              100,
              (plantSort.information.plant.attributes.harvestWindowMax /
                  (maxDuration ?? 0)) *
                  100,
          )
        : 0;
    const germinationWindowMs =
        (plantSort.information.plant.attributes?.germinationWindowMax ?? 0) *
        24 *
        60 *
        60 *
        1000;
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
            (1000 * 60 * 60 * 24),
    );

    result.growthPercentage =
        100 - result.germinationPercentage - result.harvestPercentage;
    const growthWindowMs =
        (plantSort.information.plant.attributes?.growthWindowMax ?? 0) *
        24 *
        60 *
        60 *
        1000;
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
            (1000 * 60 * 60 * 24),
    );

    result.harvestValue = field.plantReadyDate
        ? Math.min(
              100,
              ((targetDateNow - new Date(field.plantReadyDate).getTime()) /
                  (plantSort.information.plant.attributes?.harvestWindowMax ??
                      1)) *
                  100,
          )
        : 0;
    result.readyDays = Math.round(
        (targetDateNow -
            (field.plantReadyDate
                ? new Date(field.plantReadyDate).getTime()
                : targetDateNow)) /
            (1000 * 60 * 60 * 24),
    );

    return result;
}

export function RaisedBedFieldLifecycleTab({
    raisedBedId,
    positionIndex,
    onShowOperations,
}: {
    raisedBedId: number;
    positionIndex: number;
    onShowOperations?: () => void;
}) {
    const { data: garden } = useCurrentGarden();
    const {
        germinationValue,
        germinationPercentage,
        germinatingDays,
        growthValue,
        growthPercentage,
        growingDays,
        harvestValue,
        harvestPercentage,
        readyDays,
    } = useRaisedBedFieldLifecycleData(raisedBedId, positionIndex);
    const removeFieldMutation = useRaisedBedFieldRemove();

    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const field = raisedBed?.fields.find(
        (currentField) =>
            currentField.positionIndex === positionIndex && currentField.active,
    );
    const { data: plantSort } = usePlantSort(field?.plantSortId);

    if (!garden || !plantSort || !field) {
        return null;
    }

    const handleRemovePlant = async () => {
        if (!field.toBeRemoved) {
            return;
        }

        try {
            await removeFieldMutation.mutateAsync({
                raisedBedId,
                positionIndex,
            });
        } catch (error) {
            console.error('Failed to remove plant:', error);
            // TODO: Show error message to user
        }
    };

    const plantScheduledDate = field.plantScheduledDate
        ? new Date(field.plantScheduledDate)
        : null;

    let icon: ReactNode | null = null;
    const localizedStatus = plantFieldStatusLabel(field.plantStatus);
    switch (field.plantStatus) {
        case 'new':
            icon = <span className="mr-0.5">{'🌟'}</span>;
            break;
        case 'planned':
            icon = <span className="mr-0.5">{'⌛'}</span>;
            break;
        case 'sowed':
            icon = <span className="mr-0.5">{'𓇢'}</span>;
            break;
        case 'notSprouted':
            icon = <span className="mr-0.5">{'😢'}</span>;
            break;
        case 'sprouted':
            icon = <span className="mr-0.5">{'🌱'}</span>;
            break;
        case 'ready':
            icon = <span className="mr-0.5">{'🌿'}</span>;
            break;
        case 'harvested':
            icon = <span className="mr-0.5">{'✅'}</span>;
            break;
        case 'died':
            icon = <span className="mr-0.5">{'😢'}</span>;
            break;
    }

    const germinatingDaysDayPlural = germinatingDays === 1 ? 'dan' : 'dana';
    const growingDaysDayPlural = growingDays === 1 ? 'dan' : 'dana';
    const readyDaysDayPlural = readyDays === 1 ? 'dan' : 'dana';

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
                      value: germinationValue,
                      percentage: germinationPercentage,
                      color: 'stroke-yellow-500',
                      trackColor: 'stroke-yellow-200 dark:stroke-yellow-50',
                      pulse: !field.plantGrowthDate,
                      borderColor: 'stroke-yellow-500',
                  },
                  {
                      value: growthValue,
                      percentage: growthPercentage,
                      color: 'stroke-green-500',
                      trackColor: 'stroke-green-200 dark:stroke-green-50',
                      pulse: !field.plantReadyDate,
                      borderColor: 'stroke-green-500',
                  },
                  {
                      value: harvestValue,
                      percentage: harvestPercentage,
                      color: 'stroke-blue-500',
                      trackColor: 'stroke-blue-200 dark:stroke-blue-50',
                      pulse: Boolean(harvestValue),
                      borderColor: 'stroke-blue-500',
                  },
              ];

    const plantAttributes = plantSort.information.plant.attributes;

    return (
        <Stack spacing={2}>
            {plantScheduledDate && (
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
                    <Stack
                        alignItems="center"
                        className="border bg-card rounded-full shrink-0 size-[100px] aspect-square shadow flex items-center justify-center"
                    >
                        <span className="text-2xl">{icon}</span>
                        <Typography
                            level="body1"
                            className="text-center"
                            semiBold
                        >
                            {localizedStatus.shortLabel}
                        </Typography>
                    </Stack>
                </SegmentedCircularProgress>
                <Stack spacing={1}>
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
                        daysCount={germinatingDays}
                        dayPlural={germinatingDaysDayPlural}
                        fallbackText="Nije posijano"
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
                        daysCount={growingDays}
                        dayPlural={growingDaysDayPlural}
                        fallbackText="Nije u fazi rasta"
                    />
                    <PlantStageSection
                        label="Berba"
                        legendColorClass="bg-blue-500"
                        legendBorderColorClass="border-blue-500"
                        legendPulse={
                            Boolean(field.plantReadyDate) &&
                            harvestValue > 0 &&
                            harvestValue < 100
                        }
                        legendFilled={Boolean(
                            field.plantStatus === 'harvested' ||
                                harvestValue >= 100,
                        )}
                        windowMin={plantAttributes?.harvestWindowMin}
                        windowMax={plantAttributes?.harvestWindowMax}
                        startDate={
                            field.plantReadyDate
                                ? new Date(field.plantReadyDate)
                                : null
                        }
                        // In 'single' mode, startDate represents the known date to display
                        daysCount={readyDays}
                        dayPlural={readyDaysDayPlural}
                        fallbackText="Nije u fazi berbe"
                        variant="single"
                    />
                </Stack>
            </Row>

            <RecommendationsCard
                onShowOperations={onShowOperations}
                gardenId={garden.id}
                raisedBedId={raisedBedId}
                positionIndex={positionIndex}
                plantStatus={field.plantStatus as PlantFieldStatus}
                plantSortId={field.plantSortId}
            />

            {field.toBeRemoved && (
                <Row>
                    <Button
                        variant="solid"
                        fullWidth
                        loading={removeFieldMutation.isPending}
                        disabled={removeFieldMutation.isPending}
                        onClick={handleRemovePlant}
                        startDecorator={
                            <ShovelIcon className="size-5 shrink-0" />
                        }
                    >
                        Ukloni biljku
                    </Button>
                </Row>
            )}
        </Stack>
    );
}
