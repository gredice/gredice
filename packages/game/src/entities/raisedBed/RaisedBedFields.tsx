import { useGameFlags } from '../../GameFlagsContext';
import { useGameSceneDetails } from '../../GameSceneDetailContext';
import { resolveInGamePlantPreset } from '../../generators/plant/lib/inGamePlantPresets';
import {
    useCurrentGarden,
    useIsSandboxGarden,
} from '../../hooks/useCurrentGarden';
import { useAllSorts } from '../../hooks/usePlantSorts';
import { useShoppingCart } from '../../hooks/useShoppingCart';
import { useGameState } from '../../useGameState';
import {
    findRaisedBedByBlockId,
    getRaisedBedBlockIds,
} from '../../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../../utils/raisedBedFields';
import {
    mockPlantPresetLabelsBySortId,
    RaisedBedPlantField,
} from './RaisedBedPlantField';

function shouldRenderGeneratedPlantField(field: {
    positionIndex: number;
    plantStatus?: string | null;
    plantSowDate?: string | null;
}) {
    return (
        Boolean(field.plantSowDate) &&
        (field.plantStatus === 'sprouted' ||
            field.plantStatus === 'ready' ||
            field.plantStatus === 'harvested')
    );
}

export function RaisedBedFields({
    blockId,
    generatedPlantsHandledExternally = false,
}: {
    blockId: string;
    generatedPlantsHandledExternally?: boolean;
}) {
    const { renderDetails } = useGameSceneDetails();
    const flags = useGameFlags();
    const { data: currentGarden } = useCurrentGarden();
    const { data: sortData } = useAllSorts();
    const isMock = useGameState((state) => state.isMock);
    const isSandbox = useIsSandboxGarden();
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const { data: cart } = useShoppingCart(renderDetails && !isLocalSandbox);
    const raisedBed = findRaisedBedByBlockId(currentGarden, blockId);
    const orientation = raisedBed?.orientation ?? 'vertical';

    const blockIds =
        raisedBed && currentGarden
            ? getRaisedBedBlockIds(currentGarden, raisedBed.id)
            : [];

    // Bottom-right most block (last in position-sorted list) is offset 0;
    // other blocks get increasing offsets based on distance from bottom-right
    const blockIndex = blockIds.indexOf(blockId);
    const blockOffset = Math.max(blockIds.length - 1 - blockIndex, 0) * 9;

    const cartItems = cart?.items.filter(
        (item) =>
            item.gardenId === currentGarden?.id &&
            item.raisedBedId === raisedBed?.id &&
            item.entityTypeName === 'plantSort' &&
            typeof item.positionIndex === 'number' &&
            item.positionIndex >= blockOffset &&
            item.positionIndex < blockOffset + 9,
    );

    const displayedFields = [
        ...(raisedBed?.fields?.filter(
            (field) =>
                isRaisedBedFieldOccupied(field) &&
                field.positionIndex >= blockOffset &&
                field.positionIndex < blockOffset + 9,
        ) || []),
        ...(cartItems?.map((item) => {
            if (item.positionIndex === null) return null;
            const field = {
                id: `cart-item-${item.id}`,
                positionIndex: item.positionIndex,
                plantSortId: Number(item.entityId),
            };
            return field;
        }) || []),
    ];
    const generatedPlantsEnabled =
        Boolean(flags.enablePlantGeneratorFlag) || isMock || isSandbox;

    if (!renderDetails) {
        return null;
    }

    return (
        <>
            {displayedFields.map((field) => {
                if (!field) return null;
                if (
                    generatedPlantsHandledExternally &&
                    generatedPlantsEnabled &&
                    field.plantSortId &&
                    shouldRenderGeneratedPlantField(field)
                ) {
                    const sort = sortData?.find(
                        (item) => item.id === field.plantSortId,
                    );
                    const resolvedPlantPreset = resolveInGamePlantPreset([
                        sort?.information.name,
                        sort?.information.plant.information?.name,
                        sort?.information.plant.information?.latinName,
                        isMock || isSandbox
                            ? mockPlantPresetLabelsBySortId[field.plantSortId]
                            : undefined,
                    ]);

                    if (resolvedPlantPreset) {
                        return null;
                    }
                }

                return (
                    <RaisedBedPlantField
                        key={field.id}
                        field={{
                            ...field,
                            positionIndex: field.positionIndex - blockOffset,
                        }}
                        blockIndex={blockIndex}
                        orientation={orientation}
                    />
                );
            })}
        </>
    );
}
