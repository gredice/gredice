import type { OperationData } from '@gredice/client';
import { plantFieldStatusLabel } from '@gredice/js/plants';
import { OperationImage } from '@gredice/ui/OperationImage';
import { SegmentedCircularProgress } from '@gredice/ui/SegmentedCircularProgress';
import { Alert } from '@signalco/ui/Alert';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { type ReactNode, useMemo } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { useOperations } from '../../hooks/useOperations';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { useRaisedBedFieldRemove } from '../../hooks/useRaisedBedFieldRemove';
import { useSetShoppingCartItem } from '../../hooks/useSetShoppingCartItem';
import { ShovelIcon } from '../../icons/Shovel';
import {
    AnimateFlyToItem,
    useAnimateFlyToShoppingCart,
} from '../../indicators/AnimateFlyTo';
import {
    DEFAULT_FEATURED_OPERATION_LIMIT,
    FEATURED_OPERATIONS_BY_STAGE,
    PLANT_STAGE_LABELS,
    PLANT_STATUS_STAGE_SEQUENCE,
    type PlantFieldStatus,
} from './featuredOperations';

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
    const {
        data: operations,
        isLoading: isLoadingOperations,
        isError: isOperationsError,
    } = useOperations();

    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const field = raisedBed?.fields.find(
        (currentField) =>
            currentField.positionIndex === positionIndex && currentField.active,
    );
    const { data: plantSort } = usePlantSort(field?.plantSortId);

    const plantSortOperationNames = useMemo(() => {
        const operationNames =
            plantSort?.information.plant.information?.operations
                ?.map((operation) => operation.information?.name)
                .filter((name): name is string => Boolean(name)) ?? [];
        return operationNames.length ? new Set(operationNames) : null;
    }, [plantSort]);

    const stageSequence = field?.plantStatus
        ? PLANT_STATUS_STAGE_SEQUENCE[field.plantStatus as PlantFieldStatus]
        : undefined;

    const { selectedStage, stageOperations } = useMemo(() => {
        if (!stageSequence?.length) {
            return {
                selectedStage: undefined,
                stageOperations: [] as OperationData[],
            };
        }

        if (!operations) {
            return {
                selectedStage: stageSequence[0],
                stageOperations: [] as OperationData[],
            };
        }

        const plantOperations = operations.filter(
            (operation) => operation.attributes.application === 'plant',
        );

        const filterByPlantSort = (ops: OperationData[]) => {
            if (
                !plantSortOperationNames ||
                plantSortOperationNames.size === 0
            ) {
                return ops;
            }

            return ops.filter((operation) =>
                plantSortOperationNames.has(operation.information.name),
            );
        };

        for (const stage of stageSequence) {
            const stageOps = filterByPlantSort(
                plantOperations.filter(
                    (operation) =>
                        operation.attributes.stage.information?.name === stage,
                ),
            );
            if (stageOps.length > 0) {
                return { selectedStage: stage, stageOperations: stageOps };
            }
        }

        const fallbackStage = stageSequence[0];
        const fallbackOperations =
            fallbackStage != null
                ? filterByPlantSort(
                      plantOperations.filter(
                          (operation) =>
                              operation.attributes.stage.information?.name ===
                              fallbackStage,
                      ),
                  )
                : [];

        return {
            selectedStage: fallbackStage,
            stageOperations: fallbackOperations,
        };
    }, [operations, plantSortOperationNames, stageSequence]);

    const featuredOperations = useMemo(() => {
        if (!selectedStage || stageOperations.length === 0) {
            return [] as OperationData[];
        }

        const sorted = [...stageOperations].sort((a, b) => {
            const aDays = a.attributes.relativeDays ?? Number.MAX_SAFE_INTEGER;
            const bDays = b.attributes.relativeDays ?? Number.MAX_SAFE_INTEGER;

            if (aDays !== bDays) {
                return aDays - bDays;
            }

            return a.information.label.localeCompare(b.information.label);
        });

        const configuredNames = FEATURED_OPERATIONS_BY_STAGE[selectedStage];

        if (configuredNames?.length) {
            const configuredSet = new Set(configuredNames);
            const configuredOperations = sorted.filter((operation) =>
                configuredSet.has(operation.information.name),
            );
            if (configuredOperations.length > 0) {
                return configuredOperations;
            }
        }

        return sorted.slice(0, DEFAULT_FEATURED_OPERATION_LIMIT);
    }, [selectedStage, stageOperations]);

    const hasMoreOperations =
        stageOperations.length > featuredOperations.length;
    const stageLabel = selectedStage
        ? PLANT_STAGE_LABELS[selectedStage]
        : undefined;
    const isLoadingFeaturedOperations = isLoadingOperations;
    const skeletonKeys = useMemo(
        () =>
            Array.from(
                { length: DEFAULT_FEATURED_OPERATION_LIMIT },
                (_, index) => `featured-operation-skeleton-${index}`,
            ),
        [],
    );

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

    const segments = field.toBeRemoved
        ? [
              {
                  value: 100,
                  percentage: 100,
                  color: 'stroke-red-500',
                  trackColor: 'stroke-red-50 dark:stroke-red-50/80',
              },
          ]
        : [
              {
                  value: germinationValue,
                  percentage: germinationPercentage,
                  color: 'stroke-yellow-500',
                  trackColor: 'stroke-yellow-200 dark:stroke-yellow-50',
                  pulse: !field.plantGrowthDate,
              },
              {
                  value: growthValue,
                  percentage: growthPercentage,
                  color: 'stroke-green-500',
                  trackColor: 'stroke-green-200 dark:stroke-green-50',
                  pulse: !field.plantReadyDate,
              },
              {
                  value: harvestValue,
                  percentage: harvestPercentage,
                  color: 'stroke-blue-500',
                  trackColor: 'stroke-blue-200 dark:stroke-blue-50',
                  pulse: Boolean(harvestValue),
              },
          ];

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
                    <Stack>
                        <Typography level="body2" secondary>
                            Klijanje (
                            {
                                plantSort.information.plant.attributes
                                    ?.germinationWindowMin
                            }
                            -
                            {
                                plantSort.information.plant.attributes
                                    ?.germinationWindowMax
                            }{' '}
                            dana)
                        </Typography>
                        <div className="grid gap-x-2 items-center grid-cols-[auto_auto_auto] md:grid-cols-[repeat(4,auto)]">
                            <Typography>
                                {field.plantSowDate
                                    ? new Date(
                                          field.plantSowDate,
                                      ).toLocaleDateString('hr-HR')
                                    : 'Nije posijano'}
                            </Typography>
                            {field.plantSowDate && (
                                <>
                                    <span>-</span>
                                    <Typography noWrap>
                                        {field.plantGrowthDate
                                            ? new Date(
                                                  field.plantGrowthDate,
                                              ).toLocaleDateString('hr-HR')
                                            : field.stoppedDate
                                              ? new Date(
                                                    field.stoppedDate,
                                                ).toLocaleDateString('hr-HR')
                                              : 'U tijeku...'}
                                    </Typography>
                                    <Typography>
                                        ({germinatingDays}{' '}
                                        {germinatingDaysDayPlural})
                                    </Typography>
                                </>
                            )}
                        </div>
                    </Stack>
                    <Stack>
                        <Typography level="body2" secondary>
                            Rast (
                            {
                                plantSort.information.plant.attributes
                                    ?.growthWindowMin
                            }
                            -
                            {
                                plantSort.information.plant.attributes
                                    ?.growthWindowMax
                            }{' '}
                            dana)
                        </Typography>
                        <div className="grid gap-x-2 items-center grid-cols-[auto_auto_auto] md:grid-cols-[repeat(4,auto)]">
                            <Typography>
                                {field.plantGrowthDate
                                    ? new Date(
                                          field.plantGrowthDate,
                                      ).toLocaleDateString('hr-HR')
                                    : 'Nije u fazi rasta'}
                            </Typography>
                            {field.plantGrowthDate && (
                                <>
                                    <span>-</span>
                                    <Typography noWrap>
                                        {field.plantReadyDate
                                            ? new Date(
                                                  field.plantReadyDate,
                                              ).toLocaleDateString('hr-HR')
                                            : field.stoppedDate
                                              ? new Date(
                                                    field.stoppedDate,
                                                ).toLocaleDateString('hr-HR')
                                              : 'U tijeku...'}
                                    </Typography>
                                    <Typography>
                                        ({growingDays} {growingDaysDayPlural})
                                    </Typography>
                                </>
                            )}
                        </div>
                    </Stack>
                    <Stack>
                        <Typography level="body2" secondary>
                            Berba (
                            {
                                plantSort.information.plant.attributes
                                    ?.harvestWindowMin
                            }
                            -
                            {
                                plantSort.information.plant.attributes
                                    ?.harvestWindowMax
                            }{' '}
                            dana)
                        </Typography>
                        <Row spacing={0.5}>
                            <Typography>
                                {field.plantReadyDate
                                    ? new Date(
                                          field.plantReadyDate,
                                      ).toLocaleDateString('hr-HR')
                                    : 'Nije u fazi berbe'}
                            </Typography>
                            {field.plantReadyDate && (
                                <Typography>
                                    ({readyDays} {readyDaysDayPlural})
                                </Typography>
                            )}
                        </Row>
                    </Stack>
                </Stack>
            </Row>
            {stageLabel && (
                <Stack
                    spacing={1}
                    className="border border-dashed rounded-lg p-3"
                >
                    <Row
                        spacing={1}
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <Stack spacing={0}>
                            <Typography level="h5">
                                Preporučene radnje
                            </Typography>
                            <Typography level="body2" secondary>
                                Faza: {stageLabel}
                            </Typography>
                        </Stack>
                        {onShowOperations && (
                            <Button
                                variant="link"
                                size="sm"
                                className="px-0"
                                onClick={onShowOperations}
                            >
                                Sve radnje
                            </Button>
                        )}
                    </Row>
                    {isOperationsError && (
                        <Alert color="danger">
                            Greška prilikom učitavanja radnji
                        </Alert>
                    )}
                    {isLoadingFeaturedOperations ? (
                        <Stack spacing={1}>
                            {skeletonKeys.map((skeletonKey) => (
                                <Skeleton
                                    key={skeletonKey}
                                    className="h-16 w-full rounded-md"
                                />
                            ))}
                        </Stack>
                    ) : featuredOperations.length ? (
                        <Stack spacing={1}>
                            {featuredOperations.map((operation) => (
                                <FeaturedOperationButton
                                    key={operation.id}
                                    operation={operation}
                                    gardenId={garden.id}
                                    raisedBedId={raisedBedId}
                                    positionIndex={positionIndex}
                                />
                            ))}
                        </Stack>
                    ) : (
                        <Typography level="body2" secondary>
                            Trenutno nema dostupnih radnji za ovu fazu.
                        </Typography>
                    )}
                    {hasMoreOperations &&
                        onShowOperations &&
                        !isLoadingFeaturedOperations && (
                            <Button
                                variant="link"
                                size="sm"
                                className="self-start px-0"
                                onClick={onShowOperations}
                            >
                                Prikaži sve radnje
                            </Button>
                        )}
                </Stack>
            )}
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

function formatOperationPrice(price?: number | null) {
    if (price == null) {
        return 'Nepoznato';
    }

    return `${price.toFixed(2)} €`;
}

function FeaturedOperationButton({
    operation,
    gardenId,
    raisedBedId,
    positionIndex,
}: {
    operation: OperationData;
    gardenId: number;
    raisedBedId: number;
    positionIndex: number;
}) {
    const setShoppingCartItem = useSetShoppingCartItem();
    const animateFlyToShoppingCart = useAnimateFlyToShoppingCart();

    const handleClick = () => {
        setShoppingCartItem.mutate({
            amount: 1,
            entityId: operation.id.toString(),
            entityTypeName: operation.entityType.name,
            gardenId,
            raisedBedId,
            positionIndex,
        });
        animateFlyToShoppingCart.run();
    };

    const price = formatOperationPrice(operation.prices?.perOperation);

    return (
        <Button
            variant="soft"
            className="justify-start text-left h-auto gap-3 px-3 py-2"
            onClick={handleClick}
            disabled={setShoppingCartItem.isPending}
        >
            <AnimateFlyToItem {...animateFlyToShoppingCart.props}>
                <OperationImage operation={operation} size={36} />
            </AnimateFlyToItem>
            <Stack className="items-start text-left gap-0.5">
                <Typography level="body1" semiBold>
                    {operation.information.label}
                </Typography>
                {operation.information.shortDescription && (
                    <Typography
                        level="body2"
                        className="text-muted-foreground line-clamp-2"
                    >
                        {operation.information.shortDescription}
                    </Typography>
                )}
                <Typography level="body2" semiBold>
                    {price}
                </Typography>
            </Stack>
        </Button>
    );
}
