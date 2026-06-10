import { buildHarvestTracePublicUrl } from '@gredice/client';
import { calculatePlantsPerField } from '@gredice/js/plants';
import type { FieldOperationLabelData } from '@gredice/label-printer';
import {
    createOrGetHarvestTraceLink,
    type EntityStandardized,
} from '@gredice/storage';
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
type HarvestLabelField = FarmRaisedBed['fields'][number];

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

function formatScheduleLabelDate(date: Date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}.${month}.${date.getFullYear()}.`;
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
    dateLabel: string,
) {
    labels.push({
        raisedBedPhysicalId: physicalId,
        fieldLabel: formatFieldRange(fields),
        detailLabel: formatPieceCountLabel(plantCount),
        plantSortName,
        dateLabel,
    });
}

function buildSowingLabelsForFields(
    fields: SowingLabelField[],
    physicalId: string,
    plantSortById: Map<number, EntityStandardized>,
    dateLabel: string,
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
            dateLabel,
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
                    dateLabel,
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
    dateLabel: string,
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
            ...buildSowingLabelsForFields(
                fields,
                physicalId,
                plantSortById,
                dateLabel,
            ),
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
    operationData: EntityStandardized | undefined,
) {
    return (
        operationData?.information?.label ??
        operationData?.information?.name ??
        'Radnja'
    );
}

async function buildHarvestFieldLabel(
    operation: FarmOperation,
    raisedBed: FarmRaisedBed,
    field: HarvestLabelField,
    raisedBeds: FarmRaisedBed[],
    plantSortById: Map<number, EntityStandardized>,
    detailLabel: string,
    dateLabel: string,
    createTraceLink: boolean,
): Promise<FieldOperationLabelData | null> {
    const plantSortName = field.plantSortId
        ? plantSortById.get(field.plantSortId)?.information?.name
        : undefined;

    if (!raisedBed.physicalId || !plantSortName) {
        return null;
    }

    const fieldLabel = getFieldPhysicalPositionIndex(
        field,
        raisedBeds,
    ).toString();
    const label: FieldOperationLabelData = {
        raisedBedPhysicalId: raisedBed.physicalId,
        fieldLabel,
        detailLabel,
        plantSortName,
        dateLabel,
    };
    if (!createTraceLink) {
        return label;
    }

    const sortedPlantCycles = field.plantCycles?.toSorted((left, right) => {
        const startedAtDifference =
            left.startedAt.getTime() - right.startedAt.getTime();
        if (startedAtDifference !== 0) {
            return startedAtDifference;
        }

        return left.plantPlaceEventId - right.plantPlaceEventId;
    });
    const plantCycle =
        sortedPlantCycles?.findLast(
            (cycle) =>
                cycle.plantSortId === field.plantSortId &&
                cycle.active !== false,
        ) ?? sortedPlantCycles?.at(-1);
    const accountId = operation.accountId ?? raisedBed.accountId;
    const gardenId = operation.gardenId ?? raisedBed.gardenId;

    if (
        !accountId ||
        !gardenId ||
        !plantCycle ||
        typeof field.plantSortId !== 'number'
    ) {
        return label;
    }

    const traceLink = await createOrGetHarvestTraceLink({
        accountId,
        gardenId,
        raisedBedId: raisedBed.id,
        raisedBedFieldId: field.id,
        fieldPositionIndex: field.positionIndex,
        fieldLabel,
        plantPlaceEventId: plantCycle.plantPlaceEventId,
        plantSortId: field.plantSortId,
        harvestOperationId: operation.id,
    });

    return {
        ...label,
        traceLinkId: traceLink.id,
        traceStatus: traceLink.status,
        traceUrl:
            traceLink.status === 'active'
                ? buildHarvestTracePublicUrl(traceLink.publicToken)
                : undefined,
    };
}

async function buildOperationLabels(
    operation: FarmOperation,
    operationData: EntityStandardized | undefined,
    groupedRaisedBeds: FarmRaisedBed[],
    plantSortById: Map<number, EntityStandardized>,
    dateLabel: string,
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

    const detailLabel = getOperationDetailLabel(operationData);
    const createTraceLink = isHarvestOperation(operationData);
    if (operation.raisedBedFieldId) {
        const field = raisedBed.fields.find(
            (candidate) => candidate.id === operation.raisedBedFieldId,
        );
        if (!field) {
            return [];
        }

        const label = await buildHarvestFieldLabel(
            operation,
            raisedBed,
            field,
            groupedRaisedBeds,
            plantSortById,
            detailLabel,
            dateLabel,
            createTraceLink,
        );
        return label ? [label] : [];
    }

    if (
        operationData?.attributes?.application !== 'raisedBedFull' ||
        !isHarvestOperation(operationData)
    ) {
        return [];
    }

    const labels = await Promise.all(
        raisedBed.fields.map((field) =>
            buildHarvestFieldLabel(
                operation,
                raisedBed,
                field,
                groupedRaisedBeds,
                plantSortById,
                detailLabel,
                dateLabel,
                createTraceLink,
            ),
        ),
    );

    return labels.filter(
        (label): label is FieldOperationLabelData => label !== null,
    );
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

async function buildHarvestLabels(
    dayData: FarmScheduleDayData,
    plantSortById: Map<number, EntityStandardized>,
    operationDataById: Map<number, EntityStandardized>,
    dateLabel: string,
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
            ...(await buildOperationLabels(
                operation,
                operationDataById.get(operation.entityId),
                raisedBedGroup.raisedBeds,
                plantSortById,
                dateLabel,
            )),
        );
    }

    return labels.sort(compareLabelData);
}

export async function buildScheduleLabelPrintData(
    dayData: FarmScheduleDayData,
    plantSorts: EntityStandardized[] | null | undefined,
    operationsData: EntityStandardized[] | null | undefined,
    date: Date,
) {
    const plantSortById = getEntityById(plantSorts);
    const operationDataById = getEntityById(operationsData);
    const dateLabel = formatScheduleLabelDate(date);
    const sowingLabels = buildSowingLabels(dayData, plantSortById, dateLabel);
    const harvestLabels = await buildHarvestLabels(
        dayData,
        plantSortById,
        operationDataById,
        dateLabel,
    );

    return {
        labels: [...sowingLabels, ...harvestLabels],
        sowingLabelCount: sowingLabels.length,
        harvestLabelCount: harvestLabels.length,
        traceLabelCount: harvestLabels.filter((label) => label.traceUrl).length,
    };
}
