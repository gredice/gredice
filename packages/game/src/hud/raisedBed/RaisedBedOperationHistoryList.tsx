import { Alert } from '@gredice/ui/Alert';
import { Button } from '@gredice/ui/Button';
import { NoDataPlaceholder } from '@gredice/ui/NoDataPlaceholder';
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
import {
    buildSowingOperationItems,
    cartPlantSortEntityType,
    GardenOperationCard,
    sortNewestFirst,
} from '../GardenOperationsHud';
import { RaisedBedDiaryAiAction } from './RaisedBedDiaryAiAction';

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
        <Stack spacing={3}>
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
                const action =
                    flags.raisedBedImageAI &&
                    !disableActions &&
                    currentGarden &&
                    actionRaisedBedId &&
                    operation.imageUrls.length > 0 ? (
                        <RaisedBedDiaryAiAction
                            gardenId={currentGarden.id}
                            raisedBedId={actionRaisedBedId}
                            positionIndex={positionIndex}
                            entryName={
                                operationName ??
                                plantSortData?.information.name ??
                                operation.targetLabel
                            }
                            imageUrls={operation.imageUrls}
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
