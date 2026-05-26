import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useGameFlags } from '../../GameFlagsContext';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import {
    type GardenOperationItem,
    useGardenOperations,
} from '../../hooks/useGardenOperations';
import { useLiveTime } from '../../hooks/useLiveTime';
import { useOperations } from '../../hooks/useOperations';
import { useSorts } from '../../hooks/usePlantSorts';
import { useRaisedBedDiaryEntries } from '../../hooks/useRaisedBedDiaryEntries';
import {
    raisedBedFieldDiaryEntriesQueryOptions,
    useRaisedBedFieldDiaryEntries,
} from '../../hooks/useRaisedBedFieldDiaryEntries';
import {
    buildSowingOperationItems,
    cartPlantSortEntityType,
    GardenOperationCard,
    sortNewestFirst,
} from '../GardenOperationsHud';
import { RaisedBedDiaryAiAction } from './RaisedBedDiaryAiAction';

type AiHistoryEntry = {
    id: number;
    description: string | undefined;
    timestamp: Date;
    imageUrls?: string[] | null;
    isMarkdown?: boolean;
};

function buildFieldPositionById(
    garden: ReturnType<typeof useCurrentGarden>['data'],
) {
    return new Map(
        (garden?.raisedBeds ?? []).flatMap((raisedBed) =>
            raisedBed.fields.map(
                (field) => [field.id, field.positionIndex] as const,
            ),
        ),
    );
}

function filterOperationsByTarget({
    operations,
    raisedBedId,
    positionIndex,
    raisedBedFieldId,
    fieldPositionById,
}: {
    operations: GardenOperationItem[];
    raisedBedId?: number;
    positionIndex?: number;
    raisedBedFieldId?: number;
    fieldPositionById: Map<number, number>;
}) {
    return operations.filter((operation) => {
        if (
            raisedBedId !== undefined &&
            operation.raisedBedId !== raisedBedId
        ) {
            return false;
        }

        if (
            raisedBedFieldId !== undefined &&
            operation.raisedBedFieldId !== raisedBedFieldId
        ) {
            return false;
        }

        if (positionIndex !== undefined) {
            if (operation.raisedBedFieldId === null) {
                return false;
            }

            return (
                fieldPositionById.get(operation.raisedBedFieldId) ===
                positionIndex
            );
        }

        return true;
    });
}

function getAiHistoryForOperation({
    imageUrls,
    entries,
}: {
    imageUrls: string[];
    entries: AiHistoryEntry[] | undefined;
}) {
    if (!imageUrls.length || !entries?.length) {
        return undefined;
    }

    const relatedEntries = entries.filter((entry) => {
        if (!entry.isMarkdown || !entry.imageUrls?.length) {
            return false;
        }

        return imageUrls.some((imageUrl) =>
            entry.imageUrls?.includes(imageUrl),
        );
    });

    return relatedEntries.length
        ? relatedEntries.sort(
              (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
          )
        : undefined;
}

function getRaisedBedFieldPositionIndexes(
    garden: ReturnType<typeof useCurrentGarden>['data'],
    raisedBedId: number | undefined,
) {
    const raisedBed = garden?.raisedBeds.find(
        (candidate) => candidate.id === raisedBedId,
    );

    return Array.from(
        new Set(raisedBed?.fields.map((field) => field.positionIndex) ?? []),
    );
}

export function RaisedBedOperationHistoryList({
    raisedBedId,
    positionIndex,
    raisedBedFieldId,
}: {
    raisedBedId?: number;
    positionIndex?: number;
    raisedBedFieldId?: number;
}) {
    const referenceDate = useLiveTime();
    const flags = useGameFlags();
    const { data: currentGarden } = useCurrentGarden();
    const { data: operationsData } = useOperations();
    const shouldLoadAiHistory = Boolean(
        flags.raisedBedImageAI && currentGarden?.id && raisedBedId,
    );
    const { data: raisedBedDiaryEntries } = useRaisedBedDiaryEntries(
        currentGarden?.id ?? 0,
        raisedBedId ?? 0,
        { enabled: shouldLoadAiHistory && positionIndex === undefined },
    );
    const { data: raisedBedFieldDiaryEntries } = useRaisedBedFieldDiaryEntries(
        currentGarden?.id ?? 0,
        raisedBedId ?? 0,
        positionIndex ?? 0,
        {
            enabled: shouldLoadAiHistory && typeof positionIndex === 'number',
        },
    );
    const raisedBedFieldPositionIndexes = useMemo(
        () => getRaisedBedFieldPositionIndexes(currentGarden, raisedBedId),
        [currentGarden, raisedBedId],
    );
    const raisedBedFieldDiaryQueries = useQueries({
        queries: raisedBedFieldPositionIndexes.map((fieldPositionIndex) =>
            raisedBedFieldDiaryEntriesQueryOptions(
                currentGarden?.id ?? 0,
                raisedBedId ?? 0,
                fieldPositionIndex,
                {
                    enabled: shouldLoadAiHistory && positionIndex === undefined,
                },
            ),
        ),
    });
    const raisedBedWideAiHistoryEntries = [
        ...(raisedBedDiaryEntries ?? []),
        ...raisedBedFieldDiaryQueries.flatMap((query) => query.data ?? []),
    ];
    const aiHistoryEntries =
        typeof positionIndex === 'number'
            ? raisedBedFieldDiaryEntries
            : raisedBedWideAiHistoryEntries;
    const fieldPositionById = useMemo(
        () => buildFieldPositionById(currentGarden),
        [currentGarden],
    );
    const history = useGardenOperations({
        includeCompleted: true,
        pageSize: 20,
        raisedBedId,
        raisedBedFieldId,
        positionIndex,
    });
    const sowingOperations = useMemo(
        () =>
            filterOperationsByTarget({
                operations: buildSowingOperationItems(currentGarden),
                raisedBedId,
                positionIndex,
                raisedBedFieldId,
                fieldPositionById,
            }),
        [
            currentGarden,
            fieldPositionById,
            raisedBedId,
            raisedBedFieldId,
            positionIndex,
        ],
    );
    const operations = useMemo(
        () =>
            sortNewestFirst([
                ...(history.data?.pages.flatMap((page) => page.items) ?? []),
                ...sowingOperations,
            ]),
        [history.data?.pages, sowingOperations],
    );
    const sowingPlantSortIds = useMemo(
        () =>
            Array.from(
                new Set(
                    operations
                        .filter(
                            (operation) =>
                                operation.entityTypeName ===
                                cartPlantSortEntityType,
                        )
                        .map((operation) => operation.entityId),
                ),
            ),
        [operations],
    );
    const { data: sowingPlantSorts } = useSorts(
        sowingPlantSortIds.length > 0 ? sowingPlantSortIds : undefined,
    );
    const operationDataById = useMemo(
        () =>
            new Map(
                (operationsData ?? []).map((operation) => [
                    operation.id,
                    operation,
                ]),
            ),
        [operationsData],
    );
    const plantSortById = useMemo(
        () =>
            new Map(
                (sowingPlantSorts ?? []).map((plantSort) => [
                    plantSort.id,
                    plantSort,
                ]),
            ),
        [sowingPlantSorts],
    );

    if (history.isError) {
        return (
            <Alert color="danger">
                Došlo je do pogreške prilikom učitavanja radnji.
            </Alert>
        );
    }

    if (history.isLoading) {
        return (
            <Spinner
                loading
                loadingLabel="Učitavanje radnji..."
                className="mx-auto my-8 flex items-center justify-center"
            />
        );
    }

    if (operations.length === 0) {
        return (
            <NoDataPlaceholder className="p-4">
                Nema zabilježenih radnji.
            </NoDataPlaceholder>
        );
    }

    return (
        <Stack
            spacing={2}
            className="w-full min-w-0 max-w-full overflow-hidden"
        >
            {operations.map((operation) => {
                const operationData =
                    operation.entityTypeName === 'operation'
                        ? operationDataById.get(operation.entityId)
                        : undefined;
                const plantSortData =
                    operation.entityTypeName === cartPlantSortEntityType
                        ? plantSortById.get(operation.entityId)
                        : undefined;
                const operationName = operationData?.information.label;
                const actionRaisedBedId = operation.raisedBedId ?? raisedBedId;
                const actionPositionIndex =
                    positionIndex ??
                    (operation.raisedBedFieldId
                        ? fieldPositionById.get(operation.raisedBedFieldId)
                        : undefined);
                const action =
                    flags.raisedBedImageAI &&
                    currentGarden &&
                    actionRaisedBedId &&
                    operation.imageUrls.length > 0 ? (
                        <RaisedBedDiaryAiAction
                            gardenId={currentGarden.id}
                            raisedBedId={actionRaisedBedId}
                            positionIndex={actionPositionIndex}
                            entryName={
                                operationName ??
                                plantSortData?.information.name ??
                                operation.targetLabel
                            }
                            imageUrls={operation.imageUrls}
                            historyEntries={getAiHistoryForOperation({
                                imageUrls: operation.imageUrls,
                                entries: aiHistoryEntries,
                            })}
                        />
                    ) : undefined;

                return (
                    <GardenOperationCard
                        key={`${operation.entityTypeName}-${operation.id}`}
                        operation={operation}
                        operationName={operationName}
                        operationData={operationData}
                        plantSortData={plantSortData}
                        currentGarden={currentGarden}
                        referenceDate={referenceDate}
                        progressClassName="md:max-w-80"
                        action={action}
                    />
                );
            })}
            {history.hasNextPage && (
                <Button
                    variant="plain"
                    size="sm"
                    loading={history.isFetchingNextPage}
                    onClick={() => history.fetchNextPage()}
                >
                    Prikaži više
                </Button>
            )}
        </Stack>
    );
}
