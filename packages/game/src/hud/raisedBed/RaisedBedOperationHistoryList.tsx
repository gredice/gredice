import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
import { Row } from '@gredice/ui/Row';
import { Spinner } from '@gredice/ui/Spinner';
import { Stack } from '@gredice/ui/Stack';
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
import { useRaisedBedAiHistory } from '../../hooks/useRaisedBedAiHistory';
import {
    buildSowingOperationItems,
    cartPlantSortEntityType,
    GardenOperationCard,
    GardenOperationScheduleAction,
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

function buildFieldPlantSortIdById(
    garden: ReturnType<typeof useCurrentGarden>['data'],
) {
    return new Map(
        (garden?.raisedBeds ?? []).flatMap((raisedBed) =>
            raisedBed.fields.flatMap((field) =>
                typeof field.plantSortId === 'number'
                    ? [[field.id, field.plantSortId] as const]
                    : [],
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

function getOperationReferenceDate(operation: GardenOperationItem) {
    return (
        operation.completedAt ??
        operation.verifiedAt ??
        operation.canceledAt ??
        operation.scheduledAt ??
        operation.scheduledDate ??
        operation.createdAt
    );
}

export function RaisedBedOperationHistoryList({
    raisedBedId,
    positionIndex,
    raisedBedFieldId,
    disableActions = false,
}: {
    raisedBedId?: number;
    positionIndex?: number;
    raisedBedFieldId?: number;
    disableActions?: boolean;
}) {
    const referenceDate = useLiveTime();
    const flags = useGameFlags();
    const { data: currentGarden } = useCurrentGarden();
    const { data: operationsData } = useOperations();
    const shouldLoadAiHistory = Boolean(
        flags.raisedBedImageAI && currentGarden?.id && raisedBedId,
    );
    const { data: aiHistoryEntries } = useRaisedBedAiHistory(
        currentGarden?.id ?? 0,
        raisedBedId ?? 0,
        { enabled: shouldLoadAiHistory },
    );
    const fieldPositionById = useMemo(
        () => buildFieldPositionById(currentGarden),
        [currentGarden],
    );
    const fieldPlantSortIdById = useMemo(
        () => buildFieldPlantSortIdById(currentGarden),
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
                    operations.flatMap((operation) => {
                        if (
                            operation.entityTypeName === cartPlantSortEntityType
                        ) {
                            return [operation.entityId];
                        }

                        return operation.raisedBedFieldId
                            ? [
                                  fieldPlantSortIdById.get(
                                      operation.raisedBedFieldId,
                                  ),
                              ].filter(
                                  (plantSortId): plantSortId is number =>
                                      typeof plantSortId === 'number',
                              )
                            : [];
                    }),
                ),
            ),
        [fieldPlantSortIdById, operations],
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
                const entryName =
                    operationName ??
                    plantSortData?.information.name ??
                    operation.targetLabel;
                const actionRaisedBedId = operation.raisedBedId ?? raisedBedId;
                const actionPositionIndex =
                    positionIndex ??
                    (operation.raisedBedFieldId
                        ? fieldPositionById.get(operation.raisedBedFieldId)
                        : undefined);
                const scheduleAction = !disableActions ? (
                    <GardenOperationScheduleAction
                        entryName={entryName}
                        garden={currentGarden}
                        operation={operation}
                        referenceDate={referenceDate}
                    />
                ) : undefined;
                const aiAction =
                    flags.raisedBedImageAI &&
                    !disableActions &&
                    currentGarden &&
                    actionRaisedBedId &&
                    operation.imageUrls.length > 0 ? (
                        <RaisedBedDiaryAiAction
                            gardenId={currentGarden.id}
                            raisedBedId={actionRaisedBedId}
                            positionIndex={actionPositionIndex}
                            entryName={entryName}
                            imageUrls={operation.imageUrls}
                            referenceDate={getOperationReferenceDate(operation)}
                            historyEntries={getAiHistoryForOperation({
                                imageUrls: operation.imageUrls,
                                entries: aiHistoryEntries,
                            })}
                        />
                    ) : undefined;
                const action = aiAction ? (
                    <Row spacing={2} className="flex-wrap justify-end">
                        {aiAction}
                    </Row>
                ) : undefined;

                return (
                    <GardenOperationCard
                        key={`${operation.entityTypeName}-${operation.id}`}
                        operation={operation}
                        operationName={operationName}
                        operationData={operationData}
                        plantSortData={plantSortData}
                        targetPlantSortData={
                            operation.entityTypeName === 'operation' &&
                            operation.raisedBedFieldId
                                ? (plantSortById.get(
                                      fieldPlantSortIdById.get(
                                          operation.raisedBedFieldId,
                                      ) ?? 0,
                                  ) ?? undefined)
                                : undefined
                        }
                        currentGarden={currentGarden}
                        referenceDate={referenceDate}
                        progressClassName="md:max-w-80"
                        action={action}
                        scheduleAction={scheduleAction}
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
