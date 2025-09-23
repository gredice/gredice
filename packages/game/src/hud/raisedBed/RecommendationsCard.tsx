import type { OperationData } from '@gredice/client';
import { Alert } from '@signalco/ui/Alert';
import { Navigate } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardHeader, CardOverflow } from '@signalco/ui-primitives/Card';
import { List } from '@signalco/ui-primitives/List';
import { Row } from '@signalco/ui-primitives/Row';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo } from 'react';
import { useOperations } from '../../hooks/useOperations';
import { usePlantSort } from '../../hooks/usePlantSorts';
import {
    DEFAULT_FEATURED_OPERATION_LIMIT,
    FEATURED_OPERATIONS_BY_STAGE,
    PLANT_STATUS_STAGE_SEQUENCE,
    type PlantFieldStatus,
    type PlantStageName,
} from './featuredOperations';
import { OperationsListItem } from './shared/OperationsListItem';

export function RecommendationsCard({
    onShowOperations,
    gardenId,
    raisedBedId,
    positionIndex,
    plantStatus,
    plantSortId,
}: {
    onShowOperations?: () => void;
    gardenId: number;
    raisedBedId: number;
    positionIndex: number;
    plantStatus?: PlantFieldStatus;
    plantSortId?: number;
}) {
    // Fetch and prepare data for recommendations
    const {
        data: operations,
        isLoading: isLoadingOperations,
        isError: isOperationsError,
    } = useOperations();
    const { data: plantSort } = usePlantSort(plantSortId);

    const plantSortOperationNames = useMemo(() => {
        const operationNames =
            plantSort?.information.plant.information?.operations
                ?.map((operation) => operation.information?.name)
                .filter((name): name is string => Boolean(name)) ?? [];
        return operationNames.length ? new Set(operationNames) : null;
    }, [plantSort]);

    const stageSequence: PlantStageName[] | undefined = plantStatus
        ? PLANT_STATUS_STAGE_SEQUENCE[plantStatus as PlantFieldStatus]
        : undefined;

    const { selectedStage, stageOperations } = useMemo<{
        selectedStage: PlantStageName | undefined;
        stageOperations: OperationData[];
    }>(() => {
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

        const fallbackStage: PlantStageName | undefined = stageSequence[0];
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
    const isLoadingFeaturedOperations = isLoadingOperations;
    const skeletonKeys = useMemo(
        () =>
            Array.from(
                { length: DEFAULT_FEATURED_OPERATION_LIMIT },
                (_, index) => `featured-operation-skeleton-${index}`,
            ),
        [],
    );

    // Hide card if we can't determine stage for the current status
    if (!stageSequence?.length) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="pb-4">
                <Row spacing={1} justifyContent="space-between">
                    <Typography level="body1">Preporučene radnje</Typography>
                    {onShowOperations && (
                        <Button
                            variant="link"
                            size="sm"
                            onClick={onShowOperations}
                            endDecorator={
                                <Navigate className="size-4 shrink-0" />
                            }
                        >
                            Sve radnje
                        </Button>
                    )}
                </Row>
            </CardHeader>
            <CardOverflow>
                <Stack>
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
                        <List
                            variant="outlined"
                            className="border-b-0 border-l-0 border-r-0 rounded-none max-h-[25dvh] overflow-y-auto"
                        >
                            {featuredOperations.map((operation) => (
                                <OperationsListItem
                                    key={operation.id}
                                    operation={operation}
                                    gardenId={gardenId}
                                    raisedBedId={raisedBedId}
                                    positionIndex={positionIndex}
                                />
                            ))}
                        </List>
                    ) : (
                        <Typography
                            level="body2"
                            secondary
                            className="p-4 border-t"
                        >
                            Trenutno nema dostupnih radnji za ovu fazu.
                        </Typography>
                    )}
                    {hasMoreOperations &&
                        onShowOperations &&
                        !isLoadingFeaturedOperations && (
                            <div className="border-t px-4 py-2">
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="self-start px-0"
                                    onClick={onShowOperations}
                                >
                                    Prikaži sve radnje
                                </Button>
                            </div>
                        )}
                </Stack>
            </CardOverflow>
        </Card>
    );
}

export default RecommendationsCard;
