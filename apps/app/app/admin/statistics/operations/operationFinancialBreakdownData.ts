import 'server-only';

import {
    getAllOperationPrices,
    getAllOperations,
    getAllRaisedBeds,
    getEntitiesFormatted,
    getGardens,
    getPlantUpdateEvents,
} from '@gredice/storage';
import type { EntityStandardized } from '../../../../lib/@types/EntityStandardized';
import { isMissingPayoutSchemaError } from '../../farmers/payoutSchemaStatus';
import {
    buildOperationFinancialBreakdown,
    type OperationFinancialOccurrence,
} from './operationFinancialBreakdown';

const SOWING_DURATION_MINUTES = 5;

type OperationDefinition = EntityStandardized & {
    attributes?: EntityStandardized['attributes'] & {
        internal?: boolean;
    };
};

type BoundedStatisticsPeriod = {
    fromDate: Date;
    toDate: Date;
};

function parseDuration(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, value);
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }
    return 0;
}

function parsePrice(value: unknown) {
    const parsed =
        typeof value === 'number'
            ? value
            : typeof value === 'string'
              ? Number.parseFloat(value)
              : Number.NaN;

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function priceKey(
    farmId: number,
    entityTypeName: string,
    entityId: number | null,
) {
    return `${farmId.toString()}:${entityTypeName}:${entityId?.toString() ?? 'null'}`;
}

function parseSowingLocation(value: unknown) {
    return value === 'greenhouse' ? 'greenhouse' : 'direct';
}

function getSowingTypeName(location: 'direct' | 'greenhouse') {
    return location === 'greenhouse' ? 'sowingGreenhouse' : 'sowing';
}

function getSowingLabel(location: 'direct' | 'greenhouse') {
    return location === 'greenhouse'
        ? 'Sijanje (staklenički rasad)'
        : 'Sijanje (direktno)';
}

async function getOperationPricesForBreakdown() {
    try {
        return await getAllOperationPrices();
    } catch (error) {
        if (!isMissingPayoutSchemaError(error)) {
            throw error;
        }

        console.warn(
            'Operation price tables are not available for task statistics.',
        );
        return [];
    }
}

export async function getOperationFinancialBreakdownData({
    fromDate,
    toDate,
}: BoundedStatisticsPeriod) {
    const [
        completedOperations,
        sowingEvents,
        operationDefinitions,
        plantSorts,
        operationPrices,
        gardens,
        raisedBeds,
    ] = await Promise.all([
        getAllOperations({
            completedFrom: fromDate,
            completedTo: toDate,
            status: 'completed',
        }),
        getPlantUpdateEvents({
            from: fromDate,
            to: toDate,
            status: 'sowed',
        }),
        getEntitiesFormatted<OperationDefinition>('operation'),
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getOperationPricesForBreakdown(),
        getGardens(),
        getAllRaisedBeds(),
    ]);

    const operationDefinitionById = new Map(
        operationDefinitions.map((operation) => [operation.id, operation]),
    );
    const plantSortById = new Map(
        plantSorts.map((plantSort) => [plantSort.id, plantSort]),
    );
    const farmerPriceByKey = new Map(
        operationPrices.map((price) => [
            priceKey(price.farmId, price.entityTypeName, price.entityId),
            price,
        ]),
    );
    const gardenFarmById = new Map(
        gardens.map((garden) => [garden.id, garden.farmId]),
    );
    const raisedBedById = new Map(
        raisedBeds.map((raisedBed) => [raisedBed.id, raisedBed]),
    );
    const sowingEventIds = new Set(sowingEvents.map((event) => event.id));
    const sowingDetailsByEventId = new Map<
        number,
        {
            farmId: number | null;
            plantSortId: number | null;
            sowingLocation: 'direct' | 'greenhouse';
        }
    >();

    for (const raisedBed of raisedBeds) {
        const farmId = raisedBed.gardenId
            ? (gardenFarmById.get(raisedBed.gardenId) ?? null)
            : null;

        for (const field of raisedBed.fields) {
            for (const cycle of field.plantCycles) {
                const sowingLocation = parseSowingLocation(
                    cycle.sowingLocation,
                );
                for (const eventId of cycle.eventIds) {
                    if (!sowingEventIds.has(eventId)) {
                        continue;
                    }
                    sowingDetailsByEventId.set(eventId, {
                        farmId,
                        plantSortId: cycle.plantSortId ?? null,
                        sowingLocation,
                    });
                }
            }
        }
    }

    function getFarmerPrice(
        farmId: number | null,
        entityTypeName: string,
        entityId: number | null,
    ) {
        if (farmId === null) {
            return null;
        }

        const price =
            farmerPriceByKey.get(priceKey(farmId, entityTypeName, entityId)) ??
            farmerPriceByKey.get(priceKey(farmId, entityTypeName, null));

        if (price?.currency.toLowerCase() !== 'eur') {
            return null;
        }

        return parsePrice(price.pricePerUnit);
    }

    const occurrences: OperationFinancialOccurrence[] = [];

    for (const operation of completedOperations) {
        const definition = operationDefinitionById.get(operation.entityId);
        const raisedBed = operation.raisedBedId
            ? raisedBedById.get(operation.raisedBedId)
            : undefined;
        const gardenId = operation.gardenId ?? raisedBed?.gardenId ?? null;
        const farmId =
            operation.farmId ??
            (gardenId ? (gardenFarmById.get(gardenId) ?? null) : null);
        const isInternal = definition?.attributes?.internal === true;
        const userPrice = parsePrice(definition?.prices?.perOperation);

        occurrences.push({
            key: `operation:${operation.entityId.toString()}`,
            label:
                definition?.information?.label ??
                definition?.information?.name ??
                `Radnja #${operation.entityId.toString()}`,
            durationMinutes: parseDuration(definition?.attributes?.duration),
            farmerCost: operation.isAccepted
                ? getFarmerPrice(
                      farmId,
                      operation.entityTypeName,
                      operation.entityId,
                  )
                : 0,
            materialCost: parsePrice(definition?.prices?.materialCost) ?? 0,
            userCost: isInternal
                ? 0
                : userPrice && userPrice > 0
                  ? userPrice
                  : null,
        });
    }

    for (const event of sowingEvents) {
        const details = sowingDetailsByEventId.get(event.id);
        const sowingLocation = details?.sowingLocation ?? 'direct';
        const entityTypeName = getSowingTypeName(sowingLocation);
        const plantSort = details?.plantSortId
            ? plantSortById.get(details.plantSortId)
            : undefined;
        const userPrice = parsePrice(
            plantSort?.prices?.perPlant ??
                plantSort?.information?.plant?.prices?.perPlant,
        );

        occurrences.push({
            key: entityTypeName,
            label: getSowingLabel(sowingLocation),
            durationMinutes: SOWING_DURATION_MINUTES,
            farmerCost: getFarmerPrice(
                details?.farmId ?? null,
                entityTypeName,
                null,
            ),
            materialCost: 0,
            userCost: userPrice && userPrice > 0 ? userPrice : null,
        });
    }

    return buildOperationFinancialBreakdown(occurrences);
}
