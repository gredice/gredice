import type { OperationData, PlantSortData } from '@gredice/client';
import type { GardenAction } from '@gredice/js/gardenActions';
import { isOperationApplicableToPlant } from '@gredice/js/operations';
import type { SelectedPlantingOperationTarget } from '@gredice/js/plants';
import { raisedBedFieldSectionCount } from '../utils/raisedBedBlocks';
import { isRaisedBedFieldOccupied } from '../utils/raisedBedFields';
import { buildAdvancedSowingGardenPlantingVisuals } from './raisedBed/advancedSowingGardenVisuals';
import { getLegacySowingTargetAvailability } from './raisedBed/advancedSowingSubmission';
import {
    findFirstEmptyRaisedBedField,
    type RaisedBedFieldTargetCartItem,
    type RaisedBedFieldTargetGarden,
} from './raisedBed/plantPickerNavigation';
import { isSelectedPlantingOperationAvailable } from './raisedBed/selectedPlantingOperationAvailability';

type ActionPlantSort = Pick<PlantSortData, 'id'> & {
    information: {
        plant: Pick<PlantSortData['information']['plant'], 'id'> & {
            information: Pick<
                PlantSortData['information']['plant']['information'],
                'operations'
            >;
        };
    };
};

type OperationTarget = {
    raisedBedId?: number;
    raisedBedName?: string;
    positionIndex?: number;
    plantingTarget?: SelectedPlantingOperationTarget;
};

export type ResolvedGardenAction =
    | { type: 'unavailable'; message: string }
    | {
          type: 'sow';
          gardenId: number;
          raisedBedId: number;
          raisedBedName: string;
          positionIndex: number;
          plantId: number;
          sortId?: number;
      }
    | ({
          type: 'operation';
          gardenId: number;
          operation: OperationData;
      } & OperationTarget);

export function resolveGardenAction({
    action,
    garden,
    cartItems,
    sorts,
    operations,
}: {
    action: GardenAction;
    garden: RaisedBedFieldTargetGarden;
    cartItems: RaisedBedFieldTargetCartItem[];
    sorts: ActionPlantSort[];
    operations: OperationData[];
}): ResolvedGardenAction {
    if (garden.isSandbox) {
        return {
            type: 'unavailable',
            message: 'Za sjetvu i naručivanje radnji odaberi svoj stvarni vrt.',
        };
    }
    if (action.type === 'sow') {
        const matchingSorts = sorts.filter(
            (sort) => sort.information.plant.id === action.plantId,
        );
        if (
            !matchingSorts.length ||
            (action.sortId &&
                !matchingSorts.some((sort) => sort.id === action.sortId))
        ) {
            return {
                type: 'unavailable',
                message:
                    'Ova biljka ili sorta više nije dostupna. Odaberi biljku u svom vrtu.',
            };
        }
        const target = findFirstEmptyRaisedBedField(garden, cartItems);
        return target
            ? { ...action, ...target, gardenId: garden.id }
            : {
                  type: 'unavailable',
                  message:
                      'Nema slobodnog polja za sjetvu. Dodaj ili oslobodi polje u aktivnoj gredici pa pokušaj ponovno.',
              };
    }
    const operation = operations.find(
        (item) =>
            item.id === action.operationId && item.attributes.internal !== true,
    );
    if (!operation)
        return {
            type: 'unavailable',
            message: 'Ova radnja više nije dostupna.',
        };
    const result = {
        type: 'operation',
        gardenId: garden.id,
        operation,
    } satisfies ResolvedGardenAction;
    if (operation.attributes.application === 'garden') return result;
    const applicableToSort = (sortId: number) => {
        const sort = sorts.find((candidate) => candidate.id === sortId);
        return Boolean(
            sort &&
                isOperationApplicableToPlant(
                    operation,
                    new Set(
                        sort.information.plant.information.operations?.map(
                            (item) => item.information.name,
                        ) ?? [],
                    ),
                ),
        );
    };
    for (const bed of garden.raisedBeds) {
        if (!bed.isValid || bed.status !== 'active' || !bed.name?.trim())
            continue;
        const target = { raisedBedId: bed.id, raisedBedName: bed.name.trim() };
        if (
            operation.attributes.application === 'raisedBedFull' ||
            operation.attributes.application === 'raisedBed1m'
        ) {
            return { ...result, ...target };
        }
        if (operation.attributes.application !== 'plant') continue;
        const plantings = buildAdvancedSowingGardenPlantingVisuals(
            bed.plantings,
            raisedBedFieldSectionCount * 9,
        );
        for (
            let positionIndex = 0;
            positionIndex < raisedBedFieldSectionCount * 9;
            positionIndex += 1
        ) {
            const planting = plantings.find(
                (item) =>
                    item.anchorPositionIndex === positionIndex &&
                    item.selectedTask?.status === 'completed' &&
                    item.expectedLifecycleVersionEventId != null &&
                    item.lifecycleStatus !== 'removed' &&
                    isSelectedPlantingOperationAvailable(operation, item) &&
                    applicableToSort(item.plantSortId),
            );
            if (planting && planting.expectedLifecycleVersionEventId != null) {
                return {
                    ...result,
                    ...target,
                    positionIndex,
                    plantingTarget: {
                        plantingId: planting.id,
                        expectedPlantSortId: planting.plantSortId,
                        expectedLifecycleVersionEventId:
                            planting.expectedLifecycleVersionEventId,
                    },
                };
            }
            // Selected plantings must keep their versioned identity, never use a legacy field target.
            if (
                !getLegacySowingTargetAvailability({
                    plantings: bed.plantings,
                    positionIndex,
                }).available
            )
                continue;
            const field = bed.fields.find(
                (item) =>
                    item.positionIndex === positionIndex &&
                    isRaisedBedFieldOccupied(item),
            );
            if (field?.plantSortId && applicableToSort(field.plantSortId)) {
                return { ...result, ...target, positionIndex };
            }
            if (
                !field &&
                operation.attributes.appliesToEmptyFields === true &&
                findFirstEmptyRaisedBedField(
                    { ...garden, raisedBeds: [bed] },
                    cartItems,
                )?.positionIndex === positionIndex
            ) {
                return { ...result, ...target, positionIndex };
            }
        }
    }
    return {
        type: 'unavailable',
        message:
            'U ovom vrtu nema odgovarajuće gredice ili biljke za ovu radnju.',
    };
}
