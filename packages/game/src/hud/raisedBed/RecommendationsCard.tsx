import type { OperationData, PlantData } from '@gredice/client';
import { isOperationApplicableToPlant } from '@gredice/js/operations';
import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Add as Cross, Hammer, Navigate } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameAnalytics } from '../../analytics/GameAnalyticsContext';
import { sortFavoritesFirst, useFavoriteIds } from '../../hooks/useFavorites';
import { useOperations } from '../../hooks/useOperations';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { usePlants } from '../../hooks/usePlants';
import {
    DEFAULT_FEATURED_OPERATION_LIMIT,
    FEATURED_OPERATIONS_BY_STAGE,
    getPlantOperationRecommendationStages,
    type PlantFieldStatus,
    type PlantStageName,
    shouldShowPlantOperationRecommendations,
} from './featuredOperations';
import { RecommendationSection } from './RecommendationSection';
import { OperationsListItem } from './shared/OperationsListItem';
import { isPlantTargetMetadataResolved } from './shared/plantTargetMetadata';
import { useOperationContextIndicators } from './shared/useOperationContextIndicators';

type PlantHealthIssueSummary = NonNullable<
    NonNullable<PlantData['health']>['diseases']
>[number];
type PlantHealthOperationSummary = NonNullable<
    NonNullable<PlantHealthIssueSummary['operations']>['prevention']
>[number];

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
    const { track } = useGameAnalytics();
    const [operationsOpen, setOperationsOpen] = useState(false);
    const [healthOpen, setHealthOpen] = useState(false);
    const favoriteOperationIds = useFavoriteIds('operation');
    // Fetch and prepare data for recommendations
    const {
        data: operations,
        isLoading: isLoadingOperations,
        isError: isOperationsError,
    } = useOperations();
    const { data: plantSort } = usePlantSort(plantSortId);
    const isPlantMetadataResolved = isPlantTargetMetadataResolved(
        plantSortId,
        plantSort,
    );
    const { data: plants } = usePlants();
    const { shoppingCartOperationIds, scheduledOperationIds } =
        useOperationContextIndicators({
            gardenId,
            raisedBedId,
            positionIndex,
        });
    const plant = plants?.find(
        (candidate) => candidate.id === plantSort?.information.plant.id,
    );

    const plantSortOperationNames = useMemo(() => {
        const operationNames =
            plantSort?.information.plant.information?.operations
                ?.map((operation) => operation.information?.name)
                .filter((name): name is string => Boolean(name)) ?? [];
        return new Set(operationNames);
    }, [plantSort]);

    const showPlantOperationRecommendations =
        shouldShowPlantOperationRecommendations(plantStatus);
    const stageSequence: PlantStageName[] | undefined =
        getPlantOperationRecommendationStages(plantStatus);

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

        if (!operations || !isPlantMetadataResolved) {
            return {
                selectedStage: stageSequence[0],
                stageOperations: [] as OperationData[],
            };
        }

        const filterByPlantSort = (ops: OperationData[]) => {
            return ops.filter((operation) =>
                isOperationApplicableToPlant(
                    operation,
                    plantSortOperationNames,
                ),
            );
        };

        for (const stage of stageSequence) {
            const stageOps = filterByPlantSort(
                operations.filter(
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
                      operations.filter(
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
    }, [
        isPlantMetadataResolved,
        operations,
        plantSortOperationNames,
        stageSequence,
    ]);

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
                return sortFavoritesFirst(
                    configuredOperations,
                    favoriteOperationIds,
                );
            }
        }

        return sortFavoritesFirst(
            sorted.slice(0, DEFAULT_FEATURED_OPERATION_LIMIT),
            favoriteOperationIds,
        );
    }, [favoriteOperationIds, selectedStage, stageOperations]);

    const plantHealthIssues = useMemo(() => {
        if (!showPlantOperationRecommendations) {
            return [];
        }

        const plantHealth = plant?.health;
        return [
            ...(plantHealth?.diseases ?? []),
            ...(plantHealth?.pests ?? []),
        ];
    }, [plant, showPlantOperationRecommendations]);

    const { healthOperationIds, healthOperationNames } = useMemo(() => {
        const operationIds = new Set<number>();
        const operationNames = new Set<string>();
        for (const issue of plantHealthIssues) {
            const issueOperationGroups: Array<
                PlantHealthOperationSummary[] | undefined
            > = [
                issue.operations?.prevention,
                issue.operations?.reduction,
                issue.operations?.alleviation,
            ];
            for (const issueOperations of issueOperationGroups) {
                for (const operation of issueOperations ?? []) {
                    operationIds.add(operation.id);
                    operationNames.add(operation.name);
                }
            }
        }
        return {
            healthOperationIds: operationIds,
            healthOperationNames: operationNames,
        };
    }, [plantHealthIssues]);

    const healthRecommendedOperations = useMemo(() => {
        if (!operations || healthOperationIds.size === 0) {
            return [] as OperationData[];
        }

        return sortFavoritesFirst(
            operations
                .filter(
                    (operation) =>
                        healthOperationIds.has(operation.id) &&
                        isOperationApplicableToPlant(
                            operation,
                            healthOperationNames,
                        ),
                )
                .sort((left, right) =>
                    left.information.label.localeCompare(
                        right.information.label,
                        'hr',
                    ),
                ),
            favoriteOperationIds,
        );
    }, [
        favoriteOperationIds,
        healthOperationIds,
        healthOperationNames,
        operations,
    ]);

    const healthIssueLabels = useMemo(
        () => plantHealthIssues.map((issue) => issue.name),
        [plantHealthIssues],
    );

    const healthRecommendationViewKey = healthRecommendedOperations
        .map((operation) => operation.id)
        .join(',');
    const lastTrackedHealthRecommendationViewKey = useRef<string | null>(null);

    useEffect(() => {
        if (
            !healthOpen ||
            !healthRecommendationViewKey ||
            lastTrackedHealthRecommendationViewKey.current ===
                healthRecommendationViewKey
        ) {
            return;
        }

        lastTrackedHealthRecommendationViewKey.current =
            healthRecommendationViewKey;
        track('game_plant_health_recommendations_viewed', {
            garden_id: gardenId,
            raised_bed_id: raisedBedId,
            position_index: positionIndex,
            plant_sort_id: plantSortId,
            health_issue_count: plantHealthIssues.length,
            operation_count: healthRecommendedOperations.length,
        });
    }, [
        gardenId,
        healthOpen,
        healthRecommendationViewKey,
        healthRecommendedOperations.length,
        plantHealthIssues.length,
        plantSortId,
        positionIndex,
        raisedBedId,
        track,
    ]);

    const isLoadingFeaturedOperations =
        isLoadingOperations || !isPlantMetadataResolved;
    const hasStageRecommendations = Boolean(stageSequence?.length);
    const hasHealthIssueRecommendations = plantHealthIssues.length > 0;
    const isLoadingHealthOperations =
        isLoadingOperations &&
        hasHealthIssueRecommendations &&
        healthRecommendedOperations.length === 0;
    const showHealthSection =
        hasHealthIssueRecommendations &&
        (isLoadingHealthOperations || healthRecommendedOperations.length > 0);
    const skeletonKeys = useMemo(
        () =>
            Array.from(
                { length: DEFAULT_FEATURED_OPERATION_LIMIT },
                (_, index) => `featured-operation-skeleton-${index}`,
            ),
        [],
    );

    // Hide card if we can't determine stage and there are no plant health issues.
    if (!hasStageRecommendations && !hasHealthIssueRecommendations) {
        return null;
    }

    return (
        <Stack spacing={1}>
            <Typography
                level="body3"
                className="leading-tight font-semibold uppercase"
                component="h2"
            >
                Preporuke
            </Typography>
            <Card>
                <CardOverflow className="overflow-hidden">
                    <Stack className="divide-y">
                        {isOperationsError && (
                            <Alert color="danger" className="m-2">
                                Greška prilikom učitavanja radnji
                            </Alert>
                        )}
                        {hasStageRecommendations ? (
                            <RecommendationSection
                                count={featuredOperations.length}
                                icon={<Hammer className="size-4" />}
                                kind="operations"
                                onOpenChange={setOperationsOpen}
                                open={operationsOpen}
                                title="Radnje"
                            >
                                {isLoadingFeaturedOperations ? (
                                    <Stack spacing={2}>
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
                                        data-recommended-operation-list
                                        className="max-h-[25dvh] overflow-y-auto rounded-md"
                                    >
                                        {featuredOperations.map((operation) => (
                                            <OperationsListItem
                                                key={operation.id}
                                                operation={operation}
                                                gardenId={gardenId}
                                                raisedBedId={raisedBedId}
                                                positionIndex={positionIndex}
                                                inShoppingCart={shoppingCartOperationIds.has(
                                                    operation.id,
                                                )}
                                                isScheduled={scheduledOperationIds.has(
                                                    operation.id,
                                                )}
                                            />
                                        ))}
                                        {onShowOperations && (
                                            <ShowAllOperationsListItem
                                                onShowOperations={
                                                    onShowOperations
                                                }
                                            />
                                        )}
                                    </List>
                                ) : (
                                    <Typography level="body2" secondary>
                                        Trenutno nema dostupnih radnji za ovu
                                        fazu.
                                    </Typography>
                                )}
                            </RecommendationSection>
                        ) : null}
                        {showHealthSection && (
                            <RecommendationSection
                                count={healthRecommendedOperations.length}
                                icon={<Cross className="size-4" />}
                                kind="health"
                                onOpenChange={setHealthOpen}
                                open={healthOpen}
                                title="Zdravlje biljke"
                            >
                                <Stack spacing={2}>
                                    {healthIssueLabels.length > 0 && (
                                        <Typography level="body3" secondary>
                                            {healthIssueLabels
                                                .slice(0, 3)
                                                .join(', ')}
                                            {healthIssueLabels.length > 3
                                                ? ` +${healthIssueLabels.length - 3}`
                                                : ''}
                                        </Typography>
                                    )}
                                    {isLoadingHealthOperations ? (
                                        <Stack spacing={2}>
                                            {skeletonKeys.map((skeletonKey) => (
                                                <Skeleton
                                                    key={`health-${skeletonKey}`}
                                                    className="h-16 w-full rounded-md"
                                                />
                                            ))}
                                        </Stack>
                                    ) : (
                                        <List
                                            variant="outlined"
                                            data-plant-health-operation-list
                                            className="max-h-[25dvh] overflow-y-auto rounded-md"
                                        >
                                            {healthRecommendedOperations.map(
                                                (operation) => (
                                                    <OperationsListItem
                                                        key={operation.id}
                                                        operation={operation}
                                                        gardenId={gardenId}
                                                        raisedBedId={
                                                            raisedBedId
                                                        }
                                                        positionIndex={
                                                            positionIndex
                                                        }
                                                        inShoppingCart={shoppingCartOperationIds.has(
                                                            operation.id,
                                                        )}
                                                        isScheduled={scheduledOperationIds.has(
                                                            operation.id,
                                                        )}
                                                        onOperationPicked={() => {
                                                            track(
                                                                'game_plant_health_recommendation_selected',
                                                                {
                                                                    garden_id:
                                                                        gardenId,
                                                                    raised_bed_id:
                                                                        raisedBedId,
                                                                    position_index:
                                                                        positionIndex,
                                                                    plant_sort_id:
                                                                        plantSortId,
                                                                    operation_id:
                                                                        operation.id,
                                                                    operation_name:
                                                                        operation
                                                                            .information
                                                                            .name,
                                                                },
                                                            );
                                                        }}
                                                    />
                                                ),
                                            )}
                                        </List>
                                    )}
                                </Stack>
                            </RecommendationSection>
                        )}
                    </Stack>
                </CardOverflow>
            </Card>
        </Stack>
    );
}

export default RecommendationsCard;

function ShowAllOperationsListItem({
    onShowOperations,
}: {
    onShowOperations: () => void;
}) {
    return (
        <Button
            variant="plain"
            className="w-full justify-between text-start p-0 h-auto py-3 gap-3 px-4 rounded-none font-normal border-t"
            onClick={onShowOperations}
            endDecorator={<Navigate className="size-4 shrink-0" />}
        >
            <Typography level="body1" semiBold>
                Sve radnje...
            </Typography>
        </Button>
    );
}
