import {
    plantFieldStatusLabel,
    userAllowedPlantStatusTransitions,
} from '@gredice/js/plants';
import { Button } from '@gredice/ui/Button';
import { Row } from '@gredice/ui/Row';
import { ShovelIcon } from '@gredice/ui/ShovelIcon';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { usePlantSort } from '../../hooks/usePlantSorts';
import { useRaisedBedFieldRemove } from '../../hooks/useRaisedBedFieldRemove';
import { KnownPages } from '../../knownPages';
import {
    findRaisedBedFieldWithPlant,
    findRaisedBedOccupiedField,
    type RaisedBedFieldPlantHistoryEntry,
} from '../../utils/raisedBedFields';
import {
    isPlantFieldStatus,
    shouldShowPlantOperationRecommendations,
} from './featuredOperations';
import { plantFieldStatusEmoji } from './PlantFieldStatusEmoji';
import {
    getPlantLifecycleProgressData,
    PlantLifecycleProgress,
} from './PlantLifecycleProgress';
import { RaisedBedFieldStatusChange } from './RaisedBedFieldStatusChange';
import { RecommendationsCard } from './RecommendationsCard';

// TODO: Move to a separate file
export function useRaisedBedFieldLifecycleData(
    raisedBedId: number,
    positionIndex: number,
    includeInactive = false,
    fieldOverride?: RaisedBedFieldPlantHistoryEntry,
) {
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const field =
        fieldOverride ??
        (includeInactive
            ? findRaisedBedFieldWithPlant(raisedBed?.fields, positionIndex)
            : findRaisedBedOccupiedField(raisedBed?.fields, positionIndex));
    const plantSortId = field?.plantSortId;
    const { data: plantSort } = usePlantSort(plantSortId);
    return getPlantLifecycleProgressData({
        field: raisedBed && field && plantSort ? field : null,
        plantAttributes: plantSort?.information.plant.attributes,
    });
}

export function RaisedBedFieldLifecycleTab({
    raisedBedId,
    positionIndex,
    includeInactive = false,
    fieldOverride,
    onShowOperations,
}: {
    raisedBedId: number;
    positionIndex: number;
    includeInactive?: boolean;
    fieldOverride?: RaisedBedFieldPlantHistoryEntry;
    onShowOperations?: () => void;
}) {
    const { data: garden } = useCurrentGarden();
    const lifecycleData = useRaisedBedFieldLifecycleData(
        raisedBedId,
        positionIndex,
        includeInactive,
        fieldOverride,
    );
    const removeFieldMutation = useRaisedBedFieldRemove();

    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    const field =
        fieldOverride ??
        (includeInactive
            ? findRaisedBedFieldWithPlant(raisedBed?.fields, positionIndex)
            : findRaisedBedOccupiedField(raisedBed?.fields, positionIndex));
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

    const localizedStatus = plantFieldStatusLabel(
        field.plantStatus ?? undefined,
    );
    const canChangeStatus = Boolean(
        field.plantStatus &&
            userAllowedPlantStatusTransitions[field.plantStatus]?.length,
    );

    const plantAttributes = plantSort.information.plant.attributes;
    const plantDetailsUrl = KnownPages.GredicePlantSort(
        plantSort.information.plant.information?.name ??
            plantSort.information.name,
        plantSort.information.name,
    );
    const plantStatus = isPlantFieldStatus(field.plantStatus)
        ? field.plantStatus
        : undefined;
    const showPlantOperationRecommendations =
        shouldShowPlantOperationRecommendations(plantStatus);
    const statusContent = (
        <>
            <span className="text-2xl leading-none" aria-hidden="true">
                {plantFieldStatusEmoji(field.plantStatus ?? undefined)}
            </span>
            <Typography level="body1" className="text-center" semiBold>
                {localizedStatus.shortLabel}
            </Typography>
        </>
    );
    const statusTrigger = field.active ? (
        <button
            type="button"
            className="border bg-card rounded-full shrink-0 size-[100px] aspect-square shadow flex flex-col gap-1 items-center justify-center pointer-events-auto transition-colors hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-lime-700 focus-visible:ring-offset-2"
            aria-label={
                canChangeStatus
                    ? `Promijeni stanje biljke: ${localizedStatus.shortLabel}`
                    : `Stanje biljke: ${localizedStatus.shortLabel}`
            }
        >
            {statusContent}
        </button>
    ) : (
        <Stack
            alignItems="center"
            className="border bg-card rounded-full shrink-0 size-[100px] aspect-square shadow flex items-center justify-center"
        >
            {statusContent}
        </Stack>
    );

    return (
        <Stack spacing={4}>
            <PlantLifecycleProgress
                field={field}
                plantAttributes={plantAttributes}
                lifecycleData={lifecycleData}
                plantDetailsUrl={plantDetailsUrl}
                statusTrigger={
                    field.active ? (
                        <RaisedBedFieldStatusChange
                            raisedBedId={raisedBedId}
                            positionIndex={positionIndex}
                            currentStatus={field.plantStatus ?? undefined}
                            trigger={statusTrigger}
                        />
                    ) : (
                        statusTrigger
                    )
                }
            />

            {field.active &&
                typeof field.plantSortId === 'number' &&
                showPlantOperationRecommendations && (
                    <RecommendationsCard
                        onShowOperations={onShowOperations}
                        gardenId={garden.id}
                        raisedBedId={raisedBedId}
                        positionIndex={positionIndex}
                        plantStatus={plantStatus}
                        plantSortId={field.plantSortId}
                    />
                )}

            {field.active && field.toBeRemoved && (
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
