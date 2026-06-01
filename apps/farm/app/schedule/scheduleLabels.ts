import { calculatePlantsPerField } from '@gredice/js/plants';
import type { FieldOperationLabelData } from '@gredice/label-printer';
import type { EntityStandardized } from '@gredice/storage';
import type { FarmScheduleDayData } from './scheduleData';
import {
    getFieldPhysicalPositionIndex,
    groupRaisedBedsForSchedule,
} from './scheduleShared';

type FarmRaisedBed = FarmScheduleDayData['raisedBeds'][number];
type FarmRaisedBedField = FarmScheduleDayData['scheduledFields'][number];
type FarmOperation = FarmScheduleDayData['scheduledOperations'][number];
type SowingLabelField = FarmRaisedBedField & {
    physicalPositionIndex: number;
};

const SOWING_LABEL_PLANT_LIMIT = 24;

function getEntityById(entities: EntityStandardized[] | null | undefined) {
    const entityById = new Map<number, EntityStandardized>();
    if (!entities) {
        return entityById;
    }

    for (const entity of entities) {
        entityById.set(entity.id, entity);
    }

    return entityById;
}

function getPlantsPerFieldCount(
    plantSort: EntityStandardized | null | undefined,
) {
    const seedingDistance =
        plantSort?.information?.plant?.attributes?.seedingDistance;
    return typeof seedingDistance === 'number'
        ? calculatePlantsPerField(seedingDistance).totalPlants
        : null;
}

function formatPieceCountLabel(count: number) {
    return `${count} ${count === 1 ? 'KOMAD' : 'KOMADA'}`;
}

function formatFieldRange(fields: SowingLabelField[]) {
    const positions = fields.map((field) => field.physicalPositionIndex);
    const firstPosition = positions.at(0);
    const lastPosition = positions.at(-1);

    if (firstPosition === undefined || lastPosition === undefined) {
        return '';
    }

    return firstPosition === lastPosition
        ? firstPosition.toString()
        : `${firstPosition}-${lastPosition}`;
}

function addSowingLabel(
    labels: FieldOperationLabelData[],
    physicalId: string,
    fields: SowingLabelField[],
    plantCount: number,
    plantSortName: string,
) {
    labels.push({
        raisedBedPhysicalId: physicalId,
        fieldLabel: formatFieldRange(fields),
        detailLabel: formatPieceCountLabel(plantCount),
        plantSortName,
    });
}

function buildSowingLabelsForFields(
    fields: SowingLabelField[],
    physicalId: string,
    plantSortById: Map<number, EntityStandardized>,
) {
    const labels: FieldOperationLabelData[] = [];
    let activeFields: SowingLabelField[] = [];
    let activePlantSortId: number | null = null;
    let activePlantSortName = '';
    let activePlantCount = 0;

    function flushActiveLabel() {
        if (activeFields.length === 0 || !activePlantSortName) {
            activeFields = [];
            activePlantSortId = null;
            activePlantSortName = '';
            activePlantCount = 0;
            return;
        }

        addSowingLabel(
            labels,
            physicalId,
            activeFields,
            activePlantCount,
            activePlantSortName,
        );
        activeFields = [];
        activePlantSortId = null;
        activePlantSortName = '';
        activePlantCount = 0;
    }

    for (const field of fields) {
        const plantSortId = field.plantSortId;
        if (typeof plantSortId !== 'number') {
            flushActiveLabel();
            continue;
        }

        const plantSort = plantSortById.get(plantSortId);
        const plantSortName = plantSort?.information?.name;
        if (!plantSortName) {
            flushActiveLabel();
            continue;
        }

        const plantsInField = Math.max(
            1,
            getPlantsPerFieldCount(plantSort) ?? 1,
        );
        const previousField = activeFields.at(-1);
        const continuesActiveRange =
            activePlantSortId === plantSortId &&
            previousField !== undefined &&
            field.physicalPositionIndex ===
                previousField.physicalPositionIndex + 1;

        if (!continuesActiveRange) {
            flushActiveLabel();
        }

        if (plantsInField > SOWING_LABEL_PLANT_LIMIT) {
            flushActiveLabel();

            let remainingPlants = plantsInField;
            while (remainingPlants > 0) {
                const labelPlantCount = Math.min(
                    remainingPlants,
                    SOWING_LABEL_PLANT_LIMIT,
                );
                addSowingLabel(
                    labels,
                    physicalId,
                    [field],
                    labelPlantCount,
                    plantSortName,
                );
                remainingPlants -= labelPlantCount;
            }
            continue;
        }

        if (activePlantCount + plantsInField > SOWING_LABEL_PLANT_LIMIT) {
            flushActiveLabel();
        }

        activeFields.push(field);
        activePlantSortId = plantSortId;
        activePlantSortName = plantSortName;
        activePlantCount += plantsInField;
    }

    flushActiveLabel();
    return labels;
}

function buildSowingLabels(
    dayData: FarmScheduleDayData,
    plantSortById: Map<number, EntityStandardized>,
) {
    const affectedRaisedBedIds = [
        ...new Set(dayData.scheduledFields.map((field) => field.raisedBedId)),
    ];
    const raisedBedGroups = groupRaisedBedsForSchedule(
        dayData.raisedBeds,
        affectedRaisedBedIds,
    );
    const labels: FieldOperationLabelData[] = [];

    for (const { physicalId, raisedBeds } of raisedBedGroups) {
        if (!physicalId) {
            continue;
        }

        const fields = dayData.scheduledFields
            .filter(
                (field) =>
                    field.sowingLocation === 'greenhouse' &&
                    raisedBeds.some(
                        (raisedBed) => raisedBed.id === field.raisedBedId,
                    ),
            )
            .map((field) => ({
                ...field,
                physicalPositionIndex: getFieldPhysicalPositionIndex(
                    field,
                    raisedBeds,
                ),
            }))
            .sort(
                (left, right) =>
                    left.physicalPositionIndex - right.physicalPositionIndex,
            );

        labels.push(
            ...buildSowingLabelsForFields(fields, physicalId, plantSortById),
        );
    }

    return labels;
}

function isHarvestOperation(operationData: EntityStandardized | undefined) {
    const stageName =
        operationData?.attributes?.stage?.information?.name?.toLowerCase();
    if (stageName === 'harvest') {
        return true;
    }

    const operationName = operationData?.information?.name?.toLowerCase();
    return (
        operationName === 'harvestplant' ||
        operationName === 'harvestall' ||
        operationName === 'harvestmature' ||
        operationName === 'harvest50mature' ||
        operationName === 'harvest25mature'
    );
}

function shouldPrintOperationLabel(
    operationData: EntityStandardized | undefined,
) {
    return (
        operationData?.attributes?.printLabel === true ||
        isHarvestOperation(operationData)
    );
}

function getOperationDetailLabel(
    operation: FarmOperation,
    operationData: EntityStandardized | undefined,
) {
    return (
        operationData?.information?.label ??
        operationData?.information?.name ??
        `Operacija ${operation.id}`
    );
}

function buildHarvestFieldLabel(
    raisedBed: FarmRaisedBed,
    field: FarmRaisedBed['fields'][number],
    raisedBeds: FarmRaisedBed[],
    plantSortById: Map<number, EntityStandardized>,
    detailLabel: string,
) {
    const plantSortName = field.plantSortId
        ? plantSortById.get(field.plantSortId)?.information?.name
        : undefined;

    if (!raisedBed.physicalId || !plantSortName) {
        return null;
    }

    return {
        raisedBedPhysicalId: raisedBed.physicalId,
        fieldLabel: getFieldPhysicalPositionIndex(field, raisedBeds).toString(),
        detailLabel,
        plantSortName,
    };
}

function buildOperationLabels(
    operation: FarmOperation,
    operationData: EntityStandardized | undefined,
    groupedRaisedBeds: FarmRaisedBed[],
    plantSortById: Map<number, EntityStandardized>,
) {
    if (
        !shouldPrintOperationLabel(operationData) ||
        operation.raisedBedId === null
    ) {
        return [];
    }

    const raisedBed = groupedRaisedBeds.find(
        (candidate) => candidate.id === operation.raisedBedId,
    );
    if (!raisedBed) {
        return [];
    }

    const detailLabel = getOperationDetailLabel(operation, operationData);
    if (operation.raisedBedFieldId) {
        const field = raisedBed.fields.find(
            (candidate) => candidate.id === operation.raisedBedFieldId,
        );
        if (!field) {
            return [];
        }

        const label = buildHarvestFieldLabel(
            raisedBed,
            field,
            groupedRaisedBeds,
            plantSortById,
            detailLabel,
        );
        return label ? [label] : [];
    }

    if (
        operationData?.attributes?.application !== 'raisedBedFull' ||
        !isHarvestOperation(operationData)
    ) {
        return [];
    }

    return raisedBed.fields
        .map((field) =>
            buildHarvestFieldLabel(
                raisedBed,
                field,
                groupedRaisedBeds,
                plantSortById,
                detailLabel,
            ),
        )
        .filter((label): label is FieldOperationLabelData => label !== null);
}

function compareLabelData(
    left: FieldOperationLabelData,
    right: FieldOperationLabelData,
) {
    const raisedBedComparison = left.raisedBedPhysicalId.localeCompare(
        right.raisedBedPhysicalId,
        undefined,
        { numeric: true },
    );
    if (raisedBedComparison !== 0) {
        return raisedBedComparison;
    }

    const fieldComparison = left.fieldLabel.localeCompare(
        right.fieldLabel,
        undefined,
        { numeric: true },
    );
    if (fieldComparison !== 0) {
        return fieldComparison;
    }

    return left.detailLabel.localeCompare(right.detailLabel, undefined, {
        numeric: true,
    });
}

function buildHarvestLabels(
    dayData: FarmScheduleDayData,
    plantSortById: Map<number, EntityStandardized>,
    operationDataById: Map<number, EntityStandardized>,
) {
    const affectedRaisedBedIds = [
        ...new Set(
            dayData.scheduledOperations
                .map((operation) => operation.raisedBedId)
                .filter((id): id is number => id !== null),
        ),
    ];
    const raisedBedGroups = groupRaisedBedsForSchedule(
        dayData.raisedBeds,
        affectedRaisedBedIds,
    );
    const labels: FieldOperationLabelData[] = [];

    for (const operation of dayData.scheduledOperations) {
        const raisedBedGroup = raisedBedGroups.find((group) =>
            group.raisedBeds.some(
                (raisedBed) => raisedBed.id === operation.raisedBedId,
            ),
        );
        if (!raisedBedGroup) {
            continue;
        }

        labels.push(
            ...buildOperationLabels(
                operation,
                operationDataById.get(operation.entityId),
                raisedBedGroup.raisedBeds,
                plantSortById,
            ),
        );
    }

    return labels.sort(compareLabelData);
}

export function buildScheduleLabelPrintData(
    dayData: FarmScheduleDayData,
    plantSorts: EntityStandardized[] | null | undefined,
    operationsData: EntityStandardized[] | null | undefined,
) {
    const plantSortById = getEntityById(plantSorts);
    const operationDataById = getEntityById(operationsData);
    const sowingLabels = buildSowingLabels(dayData, plantSortById);
    const harvestLabels = buildHarvestLabels(
        dayData,
        plantSortById,
        operationDataById,
    );

    return {
        labels: [...sowingLabels, ...harvestLabels],
        sowingLabelCount: sowingLabels.length,
        harvestLabelCount: harvestLabels.length,
    };
}
