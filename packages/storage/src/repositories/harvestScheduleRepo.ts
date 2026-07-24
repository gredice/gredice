import 'server-only';
import type { EntityStandardized } from '../@types/EntityStandardized';
import {
    addCalendarDays,
    getTimeZoneDateKey,
    isCalendarDateKey,
} from '../helpers/timezoneUtils';
import type { SelectShoppingCartItem } from '../schema';
import { TimeSlotStatuses } from '../schema';
import { getEntitiesFormatted } from './entitiesRepo';
import {
    getRaisedBedFieldsWithEventsForBeds,
    type RaisedBedFieldWithEvents,
} from './raisedBedFieldsRepo';
import {
    getRaisedBedIdsByAccount,
    getRaisedBedMetadataByIds,
} from './raisedBedsRepo';
import { getShoppingCart } from './shoppingCartRepo';
import { getTimeSlot } from './timeSlotsRepo';

const ZAGREB_TIME_ZONE = 'Europe/Zagreb';

export type HarvestScheduleConflictCode =
    | 'cart_not_found'
    | 'delivery_slot_not_found'
    | 'delivery_slot_unavailable'
    | 'delivery_date_in_past'
    | 'harvest_target_missing'
    | 'harvest_plant_mapping_missing'
    | 'harvest_date_selection_invalid';

export type HarvestScheduleStatusCode = 404 | 409;

export class HarvestScheduleConflictError extends Error {
    constructor(
        message: string,
        public readonly statusCode: HarvestScheduleStatusCode,
        public readonly code: HarvestScheduleConflictCode,
        public readonly details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'HarvestScheduleConflictError';
    }
}

export type HarvestScheduleValidationReason =
    | 'missing_date'
    | 'invalid_date'
    | 'before_allowed_range'
    | 'after_delivery_date';

export type HarvestSchedulePlant = {
    plantId: number;
    plantSortId: number;
    name: string;
    label: string;
    maxHarvestDaysBeforeDelivery: number;
};

export type HarvestScheduleItem = {
    cartItemId: number;
    operationId: number;
    operationName: string;
    operationLabel: string;
    raisedBedId: number;
    raisedBedName: string | null;
    raisedBedLabel: string;
    positionIndex: number | null;
    targetPositionIndexes: number[];
    plants: HarvestSchedulePlant[];
    maxHarvestDaysBeforeDelivery: number;
    scheduledDate: string | null;
    allowedFrom: string;
    allowedTo: string;
    valid: boolean;
    validationReason: HarvestScheduleValidationReason | null;
};

export type HarvestSchedule = {
    deliverySlotId: number;
    deliveryDate: string;
    allValid: boolean;
    requiresAdjustment: boolean;
    items: HarvestScheduleItem[];
};

export type HarvestDateSelection = {
    cartItemId: number;
    scheduledDate: string;
};

export type CanonicalHarvestDateSelection = {
    cartItemId: number;
    scheduledDate: string;
};

type ResolvedHarvestPlant = {
    plant: EntityStandardized;
    plantSort: EntityStandardized;
};

type RaisedBedMetadata = Awaited<
    ReturnType<typeof getRaisedBedMetadataByIds>
>[number];

function parseEntityId(entityId: string) {
    if (!/^\d+$/.test(entityId)) {
        return null;
    }

    const parsed = Number(entityId);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function operationIsDeliverableHarvest(operation: EntityStandardized) {
    return (
        operation.attributes?.deliverable === true &&
        operation.attributes.stage?.information.name === 'harvest'
    );
}

export function normalizeMaxHarvestDaysBeforeDelivery(value: unknown) {
    const parsed =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && value.trim() !== ''
              ? Number(value)
              : Number.NaN;

    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function getStrictestHarvestLeadDays(values: unknown[]) {
    return values.length === 0
        ? 0
        : Math.min(
              ...values.map((value) =>
                  normalizeMaxHarvestDaysBeforeDelivery(value),
              ),
          );
}

function normalizeDateInputToZagrebDateKey(value: string) {
    if (isCalendarDateKey(value)) {
        return value;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }

    return getTimeZoneDateKey(parsed, ZAGREB_TIME_ZONE);
}

function dateKeyToUtcIso(dateKey: string) {
    return `${dateKey}T00:00:00.000Z`;
}

export function getHarvestDateRange({
    deliveryDate,
    maxHarvestDaysBeforeDelivery,
    now = new Date(),
}: {
    deliveryDate: string;
    maxHarvestDaysBeforeDelivery: number;
    now?: Date;
}) {
    if (!isCalendarDateKey(deliveryDate)) {
        throw new Error('Invalid delivery calendar date.');
    }

    const today = getTimeZoneDateKey(now, ZAGREB_TIME_ZONE);
    const leadDays = normalizeMaxHarvestDaysBeforeDelivery(
        maxHarvestDaysBeforeDelivery,
    );
    const unconstrainedFrom = addCalendarDays(deliveryDate, -leadDays);

    return {
        allowedFrom: unconstrainedFrom < today ? today : unconstrainedFrom,
        allowedTo: deliveryDate,
    };
}

function getCartItemScheduledDate(item: SelectShoppingCartItem) {
    if (!item.additionalData) {
        return {
            dateKey: null,
            reason: 'missing_date' as const,
        };
    }

    try {
        const parsed = JSON.parse(item.additionalData) as unknown;
        if (
            !parsed ||
            typeof parsed !== 'object' ||
            Array.isArray(parsed) ||
            !('scheduledDate' in parsed) ||
            typeof parsed.scheduledDate !== 'string'
        ) {
            return {
                dateKey: null,
                reason: 'missing_date' as const,
            };
        }

        const dateKey = normalizeDateInputToZagrebDateKey(parsed.scheduledDate);
        return dateKey
            ? { dateKey, reason: null }
            : { dateKey: null, reason: 'invalid_date' as const };
    } catch {
        return {
            dateKey: null,
            reason: 'invalid_date' as const,
        };
    }
}

function validateDateKeyAgainstRange({
    allowedFrom,
    allowedTo,
    dateKey,
    missingReason,
}: {
    allowedFrom: string;
    allowedTo: string;
    dateKey: string | null;
    missingReason: 'missing_date' | 'invalid_date' | null;
}): HarvestScheduleValidationReason | null {
    if (!dateKey) {
        return missingReason ?? 'missing_date';
    }
    if (dateKey < allowedFrom) {
        return 'before_allowed_range';
    }
    if (dateKey > allowedTo) {
        return 'after_delivery_date';
    }
    return null;
}

function entityName(entity: EntityStandardized, fallback: string) {
    return entity.information?.name?.trim() || fallback;
}

function entityLabel(entity: EntityStandardized, fallback: string) {
    return (
        entity.information?.label?.trim() ||
        entity.information?.name?.trim() ||
        fallback
    );
}

function raisedBedLabel(raisedBed: RaisedBedMetadata) {
    return (
        raisedBed.name?.trim() ||
        (raisedBed.physicalId
            ? `Gredica ${raisedBed.physicalId}`
            : `Gredica #${raisedBed.id.toString()}`)
    );
}

function uniqueResolvedPlants(plants: ResolvedHarvestPlant[]) {
    const byPlantSortId = new Map<number, ResolvedHarvestPlant>();
    for (const resolvedPlant of plants) {
        byPlantSortId.set(resolvedPlant.plantSort.id, resolvedPlant);
    }
    return Array.from(byPlantSortId.values()).sort(
        (left, right) => left.plantSort.id - right.plantSort.id,
    );
}

function buildHarvestScheduleItem({
    cartItem,
    deliveryDate,
    now = new Date(),
    operation,
    plants,
    raisedBed,
    targetFields,
}: {
    cartItem: SelectShoppingCartItem;
    deliveryDate: string;
    now?: Date;
    operation: EntityStandardized;
    plants: ResolvedHarvestPlant[];
    raisedBed: RaisedBedMetadata;
    targetFields: RaisedBedFieldWithEvents[];
}): HarvestScheduleItem {
    const summarizedPlants = uniqueResolvedPlants(plants).map(
        ({ plant, plantSort }) => ({
            plantId: plant.id,
            plantSortId: plantSort.id,
            name: entityName(plant, `plant-${plant.id.toString()}`),
            label: entityLabel(plant, `Biljka #${plant.id.toString()}`),
            maxHarvestDaysBeforeDelivery: normalizeMaxHarvestDaysBeforeDelivery(
                plant.attributes?.maxHarvestDaysBeforeDelivery,
            ),
        }),
    );
    const maxHarvestDaysBeforeDelivery = getStrictestHarvestLeadDays(
        summarizedPlants.map((plant) => plant.maxHarvestDaysBeforeDelivery),
    );
    const { allowedFrom, allowedTo } = getHarvestDateRange({
        deliveryDate,
        maxHarvestDaysBeforeDelivery,
        now,
    });
    const scheduledDate = getCartItemScheduledDate(cartItem);
    const validationReason = validateDateKeyAgainstRange({
        allowedFrom,
        allowedTo,
        dateKey: scheduledDate.dateKey,
        missingReason: scheduledDate.reason,
    });

    return {
        cartItemId: cartItem.id,
        operationId: operation.id,
        operationName: entityName(
            operation,
            `operation-${operation.id.toString()}`,
        ),
        operationLabel: entityLabel(
            operation,
            `Radnja #${operation.id.toString()}`,
        ),
        raisedBedId: raisedBed.id,
        raisedBedName: raisedBed.name,
        raisedBedLabel: raisedBedLabel(raisedBed),
        positionIndex: cartItem.positionIndex,
        targetPositionIndexes: targetFields
            .map((field) => field.positionIndex)
            .sort((left, right) => left - right),
        plants: summarizedPlants,
        maxHarvestDaysBeforeDelivery,
        scheduledDate: scheduledDate.dateKey,
        allowedFrom,
        allowedTo,
        valid: validationReason === null,
        validationReason,
    };
}

function targetFieldsForCartItem({
    cartItem,
    fields,
}: {
    cartItem: SelectShoppingCartItem;
    fields: RaisedBedFieldWithEvents[];
}) {
    if (cartItem.positionIndex !== null) {
        const field = fields.find(
            (candidate) =>
                candidate.positionIndex === cartItem.positionIndex &&
                candidate.active &&
                typeof candidate.plantSortId === 'number',
        );
        return field ? [field] : [];
    }

    return fields.filter(
        (field) => field.active && typeof field.plantSortId === 'number',
    );
}

function throwMissingTarget(
    cartItem: SelectShoppingCartItem,
    reason: string,
): never {
    throw new HarvestScheduleConflictError(
        'Nije moguće odrediti biljke za planiranu berbu.',
        409,
        'harvest_target_missing',
        {
            cartItemId: cartItem.id,
            raisedBedId: cartItem.raisedBedId,
            positionIndex: cartItem.positionIndex,
            reason,
        },
    );
}

function resolvePlantsForFields({
    cartItem,
    fields,
    plantSortsById,
}: {
    cartItem: SelectShoppingCartItem;
    fields: RaisedBedFieldWithEvents[];
    plantSortsById: Map<number, EntityStandardized>;
}) {
    return fields.map((field) => {
        if (typeof field.plantSortId !== 'number') {
            return throwMissingTarget(cartItem, 'missing_plant_sort');
        }

        const plantSort = plantSortsById.get(field.plantSortId);
        const plant = plantSort?.information?.plant;
        if (!plantSort || !plant) {
            throw new HarvestScheduleConflictError(
                'Sorta biljke nema povezanu matičnu biljku.',
                409,
                'harvest_plant_mapping_missing',
                {
                    cartItemId: cartItem.id,
                    plantSortId: field.plantSortId,
                    raisedBedId: cartItem.raisedBedId,
                    positionIndex: field.positionIndex,
                },
            );
        }

        return { plant, plantSort };
    });
}

export async function getHarvestScheduleForCart({
    accountId,
    cartId,
    deliverySlotId,
    now = new Date(),
}: {
    accountId?: string;
    cartId: number;
    deliverySlotId: number;
    now?: Date;
}): Promise<HarvestSchedule> {
    const [cart, deliverySlot, operations] = await Promise.all([
        getShoppingCart(cartId),
        getTimeSlot(deliverySlotId),
        getEntitiesFormatted<EntityStandardized>('operation'),
    ]);

    if (!cart || (accountId !== undefined && cart.accountId !== accountId)) {
        throw new HarvestScheduleConflictError(
            'Košarica nije pronađena.',
            404,
            'cart_not_found',
            { cartId },
        );
    }
    if (!deliverySlot) {
        throw new HarvestScheduleConflictError(
            'Termin dostave nije pronađen.',
            404,
            'delivery_slot_not_found',
            { deliverySlotId },
        );
    }
    if (deliverySlot.status !== TimeSlotStatuses.SCHEDULED) {
        throw new HarvestScheduleConflictError(
            'Termin dostave više nije dostupan.',
            409,
            'delivery_slot_unavailable',
            { deliverySlotId, status: deliverySlot.status },
        );
    }

    const deliveryDate = getTimeZoneDateKey(
        deliverySlot.startAt,
        ZAGREB_TIME_ZONE,
    );
    const today = getTimeZoneDateKey(now, ZAGREB_TIME_ZONE);
    if (deliveryDate < today) {
        throw new HarvestScheduleConflictError(
            'Termin dostave je u prošlosti.',
            409,
            'delivery_date_in_past',
            { deliveryDate, deliverySlotId },
        );
    }

    const operationsById = new Map(
        operations
            .filter(operationIsDeliverableHarvest)
            .map((operation) => [operation.id, operation]),
    );
    const harvestItems = cart.items.flatMap((item) => {
        if (item.status !== 'new' || item.entityTypeName !== 'operation') {
            return [];
        }
        const operationId = parseEntityId(item.entityId);
        const operation = operationId
            ? operationsById.get(operationId)
            : undefined;
        return operation ? [{ cartItem: item, operation }] : [];
    });

    if (harvestItems.length === 0) {
        return {
            deliverySlotId,
            deliveryDate,
            allValid: true,
            requiresAdjustment: false,
            items: [],
        };
    }

    const raisedBedIds = Array.from(
        new Set(
            harvestItems.map(({ cartItem }) => {
                if (cartItem.raisedBedId === null) {
                    return throwMissingTarget(cartItem, 'missing_raised_bed');
                }
                return cartItem.raisedBedId;
            }),
        ),
    );
    const [fieldsByRaisedBedId, raisedBedMetadata, plantSorts, accountBedIds] =
        await Promise.all([
            getRaisedBedFieldsWithEventsForBeds(raisedBedIds),
            getRaisedBedMetadataByIds(raisedBedIds),
            getEntitiesFormatted<EntityStandardized>('plantSort'),
            accountId
                ? getRaisedBedIdsByAccount(accountId)
                : Promise.resolve(raisedBedIds),
        ]);
    const raisedBedsById = new Map(
        raisedBedMetadata.map((raisedBed) => [raisedBed.id, raisedBed]),
    );
    const accountBedIdSet = new Set(accountBedIds);
    const plantSortsById = new Map(
        plantSorts.map((plantSort) => [plantSort.id, plantSort]),
    );

    const items = harvestItems.map(({ cartItem, operation }) => {
        if (cartItem.raisedBedId === null) {
            return throwMissingTarget(cartItem, 'missing_raised_bed');
        }
        const raisedBed = raisedBedsById.get(cartItem.raisedBedId);
        if (!raisedBed || !accountBedIdSet.has(cartItem.raisedBedId)) {
            return throwMissingTarget(
                cartItem,
                accountId ? 'raised_bed_not_owned' : 'raised_bed_not_found',
            );
        }

        const targetFields = targetFieldsForCartItem({
            cartItem,
            fields: fieldsByRaisedBedId.get(cartItem.raisedBedId) ?? [],
        });
        if (targetFields.length === 0) {
            return throwMissingTarget(cartItem, 'active_plant_not_found');
        }

        return buildHarvestScheduleItem({
            cartItem,
            deliveryDate,
            now,
            operation,
            plants: resolvePlantsForFields({
                cartItem,
                fields: targetFields,
                plantSortsById,
            }),
            raisedBed,
            targetFields,
        });
    });
    const allValid = items.every((item) => item.valid);

    return {
        deliverySlotId,
        deliveryDate,
        allValid,
        requiresAdjustment: !allValid,
        items,
    };
}

export function validateHarvestDateSelections(
    schedule: HarvestSchedule,
    selections: HarvestDateSelection[],
): CanonicalHarvestDateSelection[] {
    const expectedItemsById = new Map(
        schedule.items.map((item) => [item.cartItemId, item]),
    );
    const selectionsById = new Map<number, HarvestDateSelection>();
    const duplicateCartItemIds = new Set<number>();
    const unexpectedCartItemIds = new Set<number>();

    for (const selection of selections) {
        if (selectionsById.has(selection.cartItemId)) {
            duplicateCartItemIds.add(selection.cartItemId);
        }
        selectionsById.set(selection.cartItemId, selection);
        if (!expectedItemsById.has(selection.cartItemId)) {
            unexpectedCartItemIds.add(selection.cartItemId);
        }
    }

    const missingCartItemIds = schedule.items
        .filter((item) => !selectionsById.has(item.cartItemId))
        .map((item) => item.cartItemId);
    if (
        duplicateCartItemIds.size > 0 ||
        unexpectedCartItemIds.size > 0 ||
        missingCartItemIds.length > 0
    ) {
        throw new HarvestScheduleConflictError(
            'Datumi berbe ne odgovaraju sadržaju košarice.',
            409,
            'harvest_date_selection_invalid',
            {
                duplicateCartItemIds: Array.from(duplicateCartItemIds),
                missingCartItemIds,
                unexpectedCartItemIds: Array.from(unexpectedCartItemIds),
            },
        );
    }

    return schedule.items.map((item) => {
        const selection = selectionsById.get(item.cartItemId);
        const dateKey = selection
            ? normalizeDateInputToZagrebDateKey(selection.scheduledDate)
            : null;
        const validationReason = validateDateKeyAgainstRange({
            allowedFrom: item.allowedFrom,
            allowedTo: item.allowedTo,
            dateKey,
            missingReason: dateKey ? null : 'invalid_date',
        });
        if (validationReason || !dateKey) {
            throw new HarvestScheduleConflictError(
                'Odabrani datum berbe nije dopušten.',
                409,
                'harvest_date_selection_invalid',
                {
                    allowedFrom: item.allowedFrom,
                    allowedTo: item.allowedTo,
                    cartItemId: item.cartItemId,
                    reason: validationReason,
                    scheduledDate: selection?.scheduledDate,
                },
            );
        }

        return {
            cartItemId: item.cartItemId,
            scheduledDate: dateKeyToUtcIso(dateKey),
        };
    });
}
