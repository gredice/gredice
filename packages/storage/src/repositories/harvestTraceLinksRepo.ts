import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { plantFieldStatusLabel } from '@gredice/js/plants';
import {
    and,
    asc,
    count,
    desc,
    eq,
    gte,
    inArray,
    isNull,
    like,
    lte,
    or,
    sql,
} from 'drizzle-orm';
import type { EntityStandardized } from '../@types/EntityStandardized';
import {
    farmUsers,
    gardens,
    type HarvestTraceLinkStatus,
    harvestTraceLinks,
    harvestTraceScans,
    operations,
    raisedBedFields,
    raisedBeds,
    type SelectHarvestTraceLink,
} from '../schema';
import { storage } from '../storage';
import { getEntitiesFormatted } from './entitiesRepo';
import {
    getRaisedBedFieldPlantCycles,
    type RaisedBedFieldPlantCycle,
    type RaisedBedFieldPlantStatusChange,
} from './gardensRepo';
import { getOperationsByIds, type OperationStatus } from './operationsRepo';

export const HARVEST_TRACE_PUBLIC_PATH_PREFIX = '/trag';

const harvestTracePublicTokenPattern = /^[A-Za-z0-9_-]{16,96}$/;
const timelineOperationStatuses = new Set<OperationStatus>([
    'pendingVerification',
    'completed',
]);
const raisedBedFieldCountForTraceWatering = 18;

export type HarvestTraceTimelineItemKind = 'lifecycle' | 'operation';

export type PublicHarvestTraceTimelineImage = {
    url: string;
    alt?: string;
};

export type PublicHarvestTraceLocation = {
    raisedBedPhysicalId: string | null;
    raisedBedName: string;
    fieldLabel?: string;
};

export type PublicHarvestTraceTimelineItem = {
    id: string;
    kind: HarvestTraceTimelineItemKind;
    occurredAt: string;
    title: string;
    description?: string;
    imageUrl?: string;
    imageAlt?: string;
    images?: PublicHarvestTraceTimelineImage[];
    location?: PublicHarvestTraceLocation;
    operationCategoryName?: string;
    operationCount?: number;
    plantStatus?: string;
    tone?: 'seed' | 'growth' | 'ready' | 'harvest' | 'care';
};

export type PublicHarvestTraceStatusDate = {
    label: string;
    occurredAt: string;
    status: string;
    tone: NonNullable<PublicHarvestTraceTimelineItem['tone']>;
};

export type PublicHarvestTraceStatistics = {
    wateringCount: number;
    totalWaterLiters?: number;
    plantWaterLiters?: number;
    imageCount: number;
    images: PublicHarvestTraceTimelineImage[];
    otherOperationCount: number;
    otherOperationNames: string[];
    statusDates: PublicHarvestTraceStatusDate[];
};

export type PublicHarvestTrace = {
    token: string;
    title: string;
    subtitle: string;
    plantSortName: string;
    plantSortImageUrl?: string;
    plantSortImageAlt?: string;
    context: {
        raisedBedPhysicalId: string | null;
        raisedBedName: string;
        fieldLabel: string;
        harvestLabel: string;
        harvestedAt?: string;
    };
    statistics: PublicHarvestTraceStatistics;
    timeline: PublicHarvestTraceTimelineItem[];
};

export type HarvestTraceLinkAdminSummary = {
    id: number;
    publicToken: string;
    status: HarvestTraceLinkStatus;
    publicPath: string;
    plantSortName: string;
    raisedBedName: string;
    raisedBedPhysicalId: string | null;
    fieldLabel: string;
    harvestLabel: string;
    harvestOperationId: number | null;
    raisedBedId: number;
    raisedBedFieldId: number;
    gardenId: number;
    accountId: string;
    createdAt: Date;
    updatedAt: Date;
    printedAt: Date | null;
    revokedAt: Date | null;
    scanCount: number;
    firstScannedAt: Date | null;
    lastScannedAt: Date | null;
};

export type HarvestTraceLinkAdminDetail = HarvestTraceLinkAdminSummary & {
    plantPlaceEventId: number;
    plantSortId: number | null;
    fieldPositionIndex: number;
    timeline: PublicHarvestTrace | null;
};

type CreateOrGetHarvestTraceLinkInput = {
    accountId: string;
    gardenId: number;
    raisedBedId: number;
    raisedBedFieldId: number;
    fieldPositionIndex: number;
    fieldLabel: string;
    plantPlaceEventId: number;
    plantSortId?: number | null;
    harvestOperationId: number;
};

type HarvestTraceTargetRow = {
    link: SelectHarvestTraceLink;
    raisedBedName: string;
    raisedBedPhysicalId: string | null;
    actualFieldPositionIndex: number;
};

type ScanStats = {
    scanCount: number;
    firstScannedAt: Date | null;
    lastScannedAt: Date | null;
};

type HarvestTraceLinkAdminFilter = {
    query?: string;
    status?: HarvestTraceLinkStatus | 'all';
    scanState?: 'all' | 'scanned' | 'not-scanned';
    limit?: number;
};

function positiveInteger(value: number) {
    return Number.isInteger(value) && value > 0;
}

function requirePositiveInteger(value: number, name: string) {
    if (!positiveInteger(value)) {
        throw new Error(`${name} must be a positive integer.`);
    }
}

export function normalizeHarvestTraceToken(value: string | null | undefined) {
    const trimmed = value?.trim();
    if (!trimmed || !harvestTracePublicTokenPattern.test(trimmed)) {
        return null;
    }

    return trimmed;
}

export function buildHarvestTracePublicPath(token: string) {
    const normalizedToken = normalizeHarvestTraceToken(token);
    if (!normalizedToken) {
        throw new Error('Harvest trace token is invalid.');
    }

    return `${HARVEST_TRACE_PUBLIC_PATH_PREFIX}/${normalizedToken}`;
}

function createHarvestTraceToken() {
    return randomBytes(18).toString('base64url');
}

async function createUniqueHarvestTraceToken() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const publicToken = createHarvestTraceToken();
        const existing = await storage().query.harvestTraceLinks.findFirst({
            where: eq(harvestTraceLinks.publicToken, publicToken),
            columns: { id: true },
        });
        if (!existing) {
            return publicToken;
        }
    }

    throw new Error('Unable to create a unique harvest trace token.');
}

function publicTimelineItemId(token: string, parts: string[]) {
    return createHash('sha256')
        .update([token, ...parts].join(':'))
        .digest('base64url')
        .slice(0, 16);
}

function entityName(
    entity: EntityStandardized | null | undefined,
    fallback: string,
) {
    return (
        entity?.information?.label?.trim() ||
        entity?.information?.name?.trim() ||
        fallback
    );
}

function findEntityById(
    entities: EntityStandardized[] | null | undefined,
    id: number | null | undefined,
) {
    return typeof id === 'number'
        ? entities?.find((entity) => entity.id === id)
        : undefined;
}

function entityImageUrl(entity: EntityStandardized | null | undefined) {
    const url =
        entity?.image?.cover?.url ??
        entity?.images?.cover?.url ??
        entity?.information?.plant?.image?.cover?.url ??
        entity?.information?.plant?.images?.cover?.url;
    return typeof url === 'string' && url.trim() ? url : undefined;
}

function expandedEntityInformationName(value: unknown) {
    if (
        typeof value !== 'object' ||
        value === null ||
        !('information' in value)
    ) {
        return undefined;
    }

    const { information } = value;
    if (
        typeof information !== 'object' ||
        information === null ||
        !('name' in information)
    ) {
        return undefined;
    }

    const { name } = information;
    return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}

function operationCategoryName(entity: EntityStandardized | null | undefined) {
    return (
        expandedEntityInformationName(entity?.attributes?.category) ??
        expandedEntityInformationName(entity?.attributes?.stage)
    );
}

function normalizedOperationClassifier(value: string | null | undefined) {
    return value?.toLocaleLowerCase('hr-HR').replace(/[\s_-]/g, '') ?? '';
}

function isWateringOperation(label: string, categoryName?: string) {
    const normalizedCategory = normalizedOperationClassifier(categoryName);
    const normalizedLabel = normalizedOperationClassifier(label);

    return (
        normalizedCategory === 'watering' ||
        normalizedCategory.includes('zalijev') ||
        normalizedLabel.includes('zalijev') ||
        normalizedLabel.includes('water')
    );
}

function isPhotoOperation(label: string, categoryName?: string) {
    const normalizedCategory = normalizedOperationClassifier(categoryName);
    const normalizedLabel = normalizedOperationClassifier(label);

    return (
        normalizedCategory.includes('photo') ||
        normalizedCategory.includes('image') ||
        normalizedCategory.includes('fotograf') ||
        normalizedLabel.includes('fotograf') ||
        normalizedLabel.includes('slik')
    );
}

function finitePositiveNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value.replace(',', '.'));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    }

    return undefined;
}

function operationAttributeNumber(
    entity: EntityStandardized | null | undefined,
    names: string[],
) {
    if (!entity?.attributes) {
        return undefined;
    }

    for (const name of names) {
        const parsed = finitePositiveNumber(entity.attributes[name]);
        if (parsed !== undefined) {
            return parsed;
        }
    }

    return undefined;
}

function parseWaterLitersFromLabel(label: string) {
    const match =
        /(\d+(?:[.,]\d+)?)\s*(?:l|litara|litra|litre|liter|liters)\b/iu.exec(
            label,
        );
    return finitePositiveNumber(match?.[1]);
}

function operationWaterLiters(
    entity: EntityStandardized | null | undefined,
    label: string,
) {
    return (
        operationAttributeNumber(entity, [
            'waterLiters',
            'liters',
            'litres',
            'water',
            'volume',
            'amount',
        ]) ?? parseWaterLitersFromLabel(label)
    );
}

function roundedTraceNumber(value: number) {
    return Math.round(value * 10) / 10;
}

function normalizePublicImageUrls(
    urls: string[] | undefined,
    label: string,
): PublicHarvestTraceTimelineImage[] {
    if (!urls) {
        return [];
    }

    const uniqueUrls = Array.from(
        new Set(urls.map((url) => url.trim()).filter(Boolean)),
    );

    return uniqueUrls.map((url, index) => ({
        url,
        alt: `${label} - fotografija ${index + 1}`,
    }));
}

function addImages(
    target: PublicHarvestTraceTimelineImage[],
    existingUrls: Set<string>,
    images: PublicHarvestTraceTimelineImage[],
) {
    for (const image of images) {
        if (!image.url || existingUrls.has(image.url)) {
            continue;
        }

        target.push(image);
        existingUrls.add(image.url);
    }
}

function statusDate(
    date: Date | undefined,
    label: string,
    status: string,
    tone: PublicHarvestTraceStatusDate['tone'],
) {
    if (!date) {
        return null;
    }

    return {
        label,
        occurredAt: date.toISOString(),
        status,
        tone,
    } satisfies PublicHarvestTraceStatusDate;
}

const publicPlantStatusOrder = new Set([
    'sowed',
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'notSprouted',
    'died',
    'ready',
    'harvested',
    'removed',
]);

function publicPlantStatus(status: string) {
    return status === 'pendingVerification' ? 'sowed' : status;
}

function plantStatusTone(
    status: string,
): NonNullable<PublicHarvestTraceTimelineItem['tone']> {
    if (status === 'sowed') {
        return 'seed';
    }

    if (
        status === 'sprouted' ||
        status === 'firstFlowers' ||
        status === 'firstFruitSet'
    ) {
        return 'growth';
    }

    if (status === 'ready') {
        return 'ready';
    }

    if (status === 'harvested' || status === 'removed') {
        return 'harvest';
    }

    return 'care';
}

function publicPlantStatusChanges(changes: RaisedBedFieldPlantStatusChange[]) {
    const result: RaisedBedFieldPlantStatusChange[] = [];
    let previousPublicStatus: string | undefined;

    for (const change of changes) {
        const status = publicPlantStatus(change.status);

        if (
            !publicPlantStatusOrder.has(status) ||
            status === previousPublicStatus
        ) {
            continue;
        }

        result.push({ ...change, status });
        previousPublicStatus = status;
    }

    return result;
}

function plantStatusTimelineItem({
    change,
    fieldLocation,
    harvestLabel,
    sowingDescription,
    token,
}: {
    change: RaisedBedFieldPlantStatusChange;
    fieldLocation: PublicHarvestTraceLocation;
    harvestLabel: string;
    sowingDescription: string;
    token: string;
}) {
    const status = publicPlantStatus(change.status);
    const statusLabels = plantFieldStatusLabel(status);
    const title = status === 'harvested' ? harvestLabel : statusLabels.label;
    const description =
        status === 'sowed' ? sowingDescription : statusLabels.description;

    return {
        id: publicTimelineItemId(token, [
            'lifecycle',
            'status',
            status,
            change.occurredAt.toISOString(),
        ]),
        kind: 'lifecycle',
        occurredAt: change.occurredAt.toISOString(),
        title,
        description,
        ...(status === 'sowed' ? { location: fieldLocation } : {}),
        plantStatus: status,
        tone: plantStatusTone(status),
    } satisfies PublicHarvestTraceTimelineItem;
}

function plantStatusDate(change: RaisedBedFieldPlantStatusChange) {
    const status = publicPlantStatus(change.status);
    const statusLabels = plantFieldStatusLabel(status);

    return {
        label: statusLabels.shortLabel,
        occurredAt: change.occurredAt.toISOString(),
        status,
        tone: plantStatusTone(status),
    } satisfies PublicHarvestTraceStatusDate;
}

function isDateInWindow(date: Date, from: Date, to: Date) {
    return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

function compareTimelineItems(
    left: PublicHarvestTraceTimelineItem,
    right: PublicHarvestTraceTimelineItem,
) {
    const timeDifference =
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime();
    if (timeDifference !== 0) {
        return timeDifference;
    }

    return left.title.localeCompare(right.title, 'hr');
}

function timelineDayKey(item: PublicHarvestTraceTimelineItem) {
    return item.occurredAt.slice(0, 10);
}

function operationGroupKey(item: PublicHarvestTraceTimelineItem) {
    if (item.kind !== 'operation') {
        return null;
    }

    return [
        timelineDayKey(item),
        item.title,
        item.description ?? '',
        item.operationCategoryName ?? '',
        item.imageUrl ?? '',
        item.imageAlt ?? '',
    ].join('\u0000');
}

function mergeTimelineImages(
    left: PublicHarvestTraceTimelineImage[] | undefined,
    right: PublicHarvestTraceTimelineImage[] | undefined,
) {
    if (!left?.length && !right?.length) {
        return undefined;
    }

    const merged: PublicHarvestTraceTimelineImage[] = [];
    const existingUrls = new Set<string>();
    addImages(merged, existingUrls, left ?? []);
    addImages(merged, existingUrls, right ?? []);

    return merged;
}

function groupSameDayOperations(items: PublicHarvestTraceTimelineItem[]) {
    const groupedItems: PublicHarvestTraceTimelineItem[] = [];
    const operationIndexesByKey = new Map<string, number>();

    for (const item of items) {
        const groupKey = operationGroupKey(item);
        if (!groupKey) {
            groupedItems.push(item);
            continue;
        }

        const existingIndex = operationIndexesByKey.get(groupKey);
        if (existingIndex === undefined) {
            operationIndexesByKey.set(groupKey, groupedItems.length);
            groupedItems.push(item);
            continue;
        }

        const existingItem = groupedItems[existingIndex];
        groupedItems[existingIndex] = {
            ...existingItem,
            operationCount:
                (existingItem.operationCount ?? 1) + (item.operationCount ?? 1),
            images: mergeTimelineImages(existingItem.images, item.images),
        };
    }

    return groupedItems;
}

function pushTimelineItem(
    items: PublicHarvestTraceTimelineItem[],
    item: PublicHarvestTraceTimelineItem | null,
) {
    if (!item) {
        return;
    }

    items.push(item);
}

function lifecycleTimelineItem({
    date,
    description,
    location,
    title,
    token,
    tone,
    type,
}: {
    date: Date | undefined;
    description?: string;
    location?: PublicHarvestTraceLocation;
    title: string;
    token: string;
    tone: PublicHarvestTraceTimelineItem['tone'];
    type: string;
}) {
    if (!date) {
        return null;
    }

    return {
        id: publicTimelineItemId(token, [
            'lifecycle',
            type,
            date.toISOString(),
        ]),
        kind: 'lifecycle',
        occurredAt: date.toISOString(),
        title,
        description,
        ...(location ? { location } : {}),
        tone,
    } satisfies PublicHarvestTraceTimelineItem;
}

function getOperationTimelineDate(operation: {
    completedAt?: Date;
    verifiedAt?: Date;
    timestamp: Date;
}) {
    return operation.completedAt ?? operation.verifiedAt ?? operation.timestamp;
}

function operationTimelineItem({
    categoryName,
    date,
    fieldLevel,
    imageAlt,
    images,
    imageUrl,
    label,
    operationId,
    token,
}: {
    date: Date;
    fieldLevel: boolean;
    imageAlt?: string;
    images?: PublicHarvestTraceTimelineImage[];
    imageUrl?: string;
    label: string;
    operationId: number;
    token: string;
    categoryName?: string;
}) {
    return {
        id: publicTimelineItemId(token, [
            'operation',
            operationId.toString(),
            date.toISOString(),
        ]),
        kind: 'operation',
        occurredAt: date.toISOString(),
        title: label,
        description: fieldLevel
            ? 'Radnja je obavljena na ovom polju.'
            : 'Radnja je obavljena na cijeloj gredici.',
        ...(imageUrl ? { imageUrl, imageAlt: imageAlt ?? label } : {}),
        ...(images && images.length > 0 ? { images } : {}),
        ...(categoryName ? { operationCategoryName: categoryName } : {}),
        tone: 'care',
    } satisfies PublicHarvestTraceTimelineItem;
}

function getCycleEndDate(
    link: SelectHarvestTraceLink,
    cycle: RaisedBedFieldPlantCycle,
    harvestOperation:
        | (Awaited<ReturnType<typeof getOperationsByIds>>[number] & {
              completedAt?: Date;
              verifiedAt?: Date;
          })
        | undefined,
) {
    return (
        cycle.plantHarvestedDate ??
        cycle.stoppedDate ??
        (harvestOperation
            ? getOperationTimelineDate(harvestOperation)
            : null) ??
        link.createdAt
    );
}

async function getTraceTargetByToken(
    token: string,
    statuses: HarvestTraceLinkStatus[],
) {
    if (statuses.length === 0) {
        return null;
    }

    const rows = await storage()
        .select({
            link: harvestTraceLinks,
            raisedBedName: raisedBeds.name,
            raisedBedPhysicalId: raisedBeds.physicalId,
            actualFieldPositionIndex: raisedBedFields.positionIndex,
        })
        .from(harvestTraceLinks)
        .innerJoin(gardens, eq(harvestTraceLinks.gardenId, gardens.id))
        .innerJoin(raisedBeds, eq(harvestTraceLinks.raisedBedId, raisedBeds.id))
        .innerJoin(
            raisedBedFields,
            eq(harvestTraceLinks.raisedBedFieldId, raisedBedFields.id),
        )
        .innerJoin(
            operations,
            eq(harvestTraceLinks.harvestOperationId, operations.id),
        )
        .where(
            and(
                eq(harvestTraceLinks.publicToken, token),
                inArray(harvestTraceLinks.status, statuses),
                eq(gardens.isDeleted, false),
                eq(raisedBeds.isDeleted, false),
                eq(raisedBedFields.isDeleted, false),
                eq(operations.isDeleted, false),
            ),
        )
        .limit(1);

    return rows[0] ?? null;
}

async function getTraceTargetById(id: number) {
    const rows = await storage()
        .select({
            link: harvestTraceLinks,
            raisedBedName: raisedBeds.name,
            raisedBedPhysicalId: raisedBeds.physicalId,
            actualFieldPositionIndex: raisedBedFields.positionIndex,
        })
        .from(harvestTraceLinks)
        .innerJoin(gardens, eq(harvestTraceLinks.gardenId, gardens.id))
        .innerJoin(raisedBeds, eq(harvestTraceLinks.raisedBedId, raisedBeds.id))
        .innerJoin(
            raisedBedFields,
            eq(harvestTraceLinks.raisedBedFieldId, raisedBedFields.id),
        )
        .where(eq(harvestTraceLinks.id, id))
        .limit(1);

    return rows[0] ?? null;
}

async function findTracePlantCycle(target: HarvestTraceTargetRow) {
    const cycles = await getRaisedBedFieldPlantCycles(target.link.raisedBedId);

    return (
        cycles.find(
            (cycle) =>
                cycle.positionIndex === target.link.fieldPositionIndex &&
                cycle.plantPlaceEventId === target.link.plantPlaceEventId,
        ) ?? null
    );
}

async function getRelevantOperationsForTrace(
    link: SelectHarvestTraceLink,
    cycle: RaisedBedFieldPlantCycle,
    cycleEndDate: Date,
) {
    const rows = await storage()
        .select({ id: operations.id })
        .from(operations)
        .where(
            and(
                eq(operations.accountId, link.accountId),
                eq(operations.gardenId, link.gardenId),
                eq(operations.raisedBedId, link.raisedBedId),
                eq(operations.isDeleted, false),
                or(
                    eq(operations.raisedBedFieldId, link.raisedBedFieldId),
                    isNull(operations.raisedBedFieldId),
                ),
            ),
        )
        .orderBy(asc(operations.timestamp));

    const hydratedOperations = await getOperationsByIds(
        rows.map((row) => row.id),
    );
    const operationOrder = new Map(
        rows.map((row, index) => [row.id, index] as const),
    );

    return hydratedOperations
        .toSorted(
            (left, right) =>
                (operationOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
                (operationOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        )
        .filter((operation) => {
            if (!timelineOperationStatuses.has(operation.status)) {
                return false;
            }

            const operationDate = getOperationTimelineDate(operation);
            return isDateInWindow(operationDate, cycle.startedAt, cycleEndDate);
        });
}

async function buildPublicTrace(
    target: HarvestTraceTargetRow,
): Promise<PublicHarvestTrace | null> {
    const cycle = await findTracePlantCycle(target);
    if (!cycle) {
        return null;
    }

    const [plantSorts, operationEntities, harvestOperations] =
        await Promise.all([
            getEntitiesFormatted<EntityStandardized>('plantSort'),
            getEntitiesFormatted<EntityStandardized>('operation'),
            target.link.harvestOperationId
                ? getOperationsByIds([target.link.harvestOperationId])
                : [],
        ]);
    const harvestOperation = harvestOperations[0];
    const cycleEndDate = getCycleEndDate(target.link, cycle, harvestOperation);
    const relevantOperations = await getRelevantOperationsForTrace(
        target.link,
        cycle,
        cycleEndDate,
    );
    const plantSort = findEntityById(plantSorts, target.link.plantSortId);
    const plantSortName = entityName(plantSort, 'Ubrana biljka');
    const harvestEntity = findEntityById(
        operationEntities,
        target.link.harvestOperationId ? harvestOperation?.entityId : undefined,
    );
    const harvestLabel = entityName(harvestEntity, 'Berba');
    const timeline: PublicHarvestTraceTimelineItem[] = [];
    const statisticsImages: PublicHarvestTraceTimelineImage[] = [];
    const statisticsImageUrls = new Set<string>();
    let wateringCount = 0;
    let totalWaterLiters = 0;
    let plantWaterLiters = 0;
    let hasWaterLiters = false;
    let otherOperationCount = 0;
    const otherOperationNames: string[] = [];
    const token = target.link.publicToken;
    const fieldLocation = {
        raisedBedPhysicalId: target.raisedBedPhysicalId,
        raisedBedName: target.raisedBedName,
        fieldLabel: target.link.fieldLabel,
    } satisfies PublicHarvestTraceLocation;
    const sowingDescription =
        cycle.sowingLocation === 'greenhouse'
            ? 'Biljka je uzgojena u plasteniku prije presađivanja u gredicu.'
            : 'Biljka je posijana izravno u gredicu.';
    const statusChanges = publicPlantStatusChanges(cycle.statusChanges);
    const statusChangeStatuses = new Set(
        statusChanges.map((change) => change.status),
    );
    const shouldUseStatusChangeTimeline = statusChanges.length > 0;

    pushTimelineItem(
        timeline,
        lifecycleTimelineItem({
            date: cycle.plantScheduledDate,
            title: 'Plan sjetve',
            description: 'Uzgojni ciklus planiran je za ovo polje.',
            token,
            tone: 'seed',
            type: 'scheduled',
        }),
    );

    if (shouldUseStatusChangeTimeline) {
        for (const change of statusChanges) {
            pushTimelineItem(
                timeline,
                plantStatusTimelineItem({
                    change,
                    fieldLocation,
                    harvestLabel,
                    sowingDescription,
                    token,
                }),
            );
        }
    } else {
        pushTimelineItem(
            timeline,
            lifecycleTimelineItem({
                date: cycle.plantSowDate ?? cycle.startedAt,
                title: 'Sijanje',
                description: sowingDescription,
                location: fieldLocation,
                token,
                tone: 'seed',
                type: 'sowed',
            }),
        );
        pushTimelineItem(
            timeline,
            lifecycleTimelineItem({
                date: cycle.plantGrowthDate,
                title: 'Početak rasta',
                description: 'Zabilježen je početak aktivnog rasta.',
                token,
                tone: 'growth',
                type: 'growth',
            }),
        );
        pushTimelineItem(
            timeline,
            lifecycleTimelineItem({
                date: cycle.plantReadyDate,
                title: 'Spremno za berbu',
                description: 'Biljka je označena spremnom za berbu.',
                token,
                tone: 'ready',
                type: 'ready',
            }),
        );
    }

    for (const operation of relevantOperations) {
        if (operation.id === target.link.harvestOperationId) {
            continue;
        }

        const operationEntity = findEntityById(
            operationEntities,
            operation.entityId,
        );
        const operationLabel = entityName(operationEntity, 'Radnja u gredici');
        const categoryName = operationCategoryName(operationEntity);
        const operationImages = normalizePublicImageUrls(
            operation.imageUrls,
            operationLabel,
        );
        const isWatering = isWateringOperation(operationLabel, categoryName);
        const isPhoto = isPhotoOperation(operationLabel, categoryName);

        addImages(statisticsImages, statisticsImageUrls, operationImages);

        if (isWatering) {
            wateringCount += 1;

            const waterLiters = operationWaterLiters(
                operationEntity,
                operationLabel,
            );
            if (waterLiters !== undefined) {
                hasWaterLiters = true;
                totalWaterLiters += waterLiters;
                plantWaterLiters +=
                    operation.raisedBedFieldId === null
                        ? waterLiters / raisedBedFieldCountForTraceWatering
                        : waterLiters;
            }
        } else if (!isPhoto) {
            otherOperationCount += 1;
            if (
                otherOperationNames.length < 3 &&
                !otherOperationNames.includes(operationLabel)
            ) {
                otherOperationNames.push(operationLabel);
            }
        }

        timeline.push(
            operationTimelineItem({
                categoryName,
                date: getOperationTimelineDate(operation),
                fieldLevel: operation.raisedBedFieldId !== null,
                imageAlt: operationLabel,
                images: operationImages,
                imageUrl: entityImageUrl(operationEntity),
                label: operationLabel,
                operationId: operation.id,
                token,
            }),
        );
    }

    if (!statusChangeStatuses.has('harvested')) {
        pushTimelineItem(
            timeline,
            lifecycleTimelineItem({
                date:
                    cycle.plantHarvestedDate ??
                    (harvestOperation
                        ? getOperationTimelineDate(harvestOperation)
                        : undefined),
                title: harvestLabel,
                description:
                    'Berba je završena, a etiketa je povezana s ovim tragom berbe.',
                token,
                tone: 'harvest',
                type: 'harvest',
            }),
        );
    }

    if (!statusChangeStatuses.has('removed')) {
        pushTimelineItem(
            timeline,
            lifecycleTimelineItem({
                date: cycle.plantRemovedDate,
                title: 'Polje oslobođeno',
                description: 'Polje je oslobođeno nakon završetka ciklusa.',
                token,
                tone: 'harvest',
                type: 'removed',
            }),
        );
    }

    const harvestDate =
        cycle.plantHarvestedDate ??
        (harvestOperation
            ? getOperationTimelineDate(harvestOperation)
            : undefined);
    const statusDates = shouldUseStatusChangeTimeline
        ? statusChanges.map(plantStatusDate)
        : [
              statusDate(
                  cycle.plantSowDate ?? cycle.startedAt,
                  'Sijanje',
                  'sowed',
                  'seed',
              ),
              statusDate(
                  cycle.plantGrowthDate,
                  'Početak rasta',
                  'sprouted',
                  'growth',
              ),
              statusDate(
                  cycle.plantReadyDate,
                  'Spremno za berbu',
                  'ready',
                  'ready',
              ),
              statusDate(harvestDate, harvestLabel, 'harvested', 'harvest'),
              statusDate(
                  cycle.plantRemovedDate,
                  'Polje oslobođeno',
                  'removed',
                  'harvest',
              ),
          ].filter(
              (item): item is PublicHarvestTraceStatusDate => item !== null,
          );
    const sortedTimeline = groupSameDayOperations(
        timeline.toSorted(compareTimelineItems),
    );
    const imageUrl = entityImageUrl(plantSort);

    return {
        token,
        title: plantSortName,
        subtitle: 'Put od sjetve do berbe',
        plantSortName,
        ...(imageUrl
            ? {
                  plantSortImageUrl: imageUrl,
                  plantSortImageAlt: plantSortName,
              }
            : {}),
        context: {
            raisedBedPhysicalId: target.raisedBedPhysicalId,
            raisedBedName: target.raisedBedName,
            fieldLabel: target.link.fieldLabel,
            harvestLabel,
            harvestedAt:
                cycle.plantHarvestedDate?.toISOString() ??
                (harvestOperation
                    ? getOperationTimelineDate(harvestOperation).toISOString()
                    : undefined),
        },
        statistics: {
            wateringCount,
            ...(hasWaterLiters
                ? {
                      totalWaterLiters: roundedTraceNumber(totalWaterLiters),
                      plantWaterLiters: roundedTraceNumber(plantWaterLiters),
                  }
                : {}),
            imageCount: statisticsImages.length,
            images: statisticsImages,
            otherOperationCount,
            otherOperationNames,
            statusDates,
        },
        timeline: sortedTimeline,
    };
}

export async function createOrGetHarvestTraceLink(
    input: CreateOrGetHarvestTraceLinkInput,
) {
    requirePositiveInteger(input.gardenId, 'gardenId');
    requirePositiveInteger(input.raisedBedId, 'raisedBedId');
    requirePositiveInteger(input.raisedBedFieldId, 'raisedBedFieldId');
    requirePositiveInteger(input.plantPlaceEventId, 'plantPlaceEventId');
    requirePositiveInteger(input.harvestOperationId, 'harvestOperationId');

    const existing = await storage().query.harvestTraceLinks.findFirst({
        where: and(
            eq(harvestTraceLinks.harvestOperationId, input.harvestOperationId),
            eq(harvestTraceLinks.raisedBedFieldId, input.raisedBedFieldId),
            eq(harvestTraceLinks.plantPlaceEventId, input.plantPlaceEventId),
        ),
    });
    if (existing) {
        return existing;
    }

    const publicToken = await createUniqueHarvestTraceToken();
    const tracePath = buildHarvestTracePublicPath(publicToken);
    const [inserted] = await storage()
        .insert(harvestTraceLinks)
        .values({
            publicToken,
            status: 'active',
            accountId: input.accountId,
            gardenId: input.gardenId,
            raisedBedId: input.raisedBedId,
            raisedBedFieldId: input.raisedBedFieldId,
            fieldPositionIndex: input.fieldPositionIndex,
            fieldLabel: input.fieldLabel,
            plantPlaceEventId: input.plantPlaceEventId,
            plantSortId: input.plantSortId ?? null,
            harvestOperationId: input.harvestOperationId,
            tracePath,
        })
        .onConflictDoNothing({
            target: [
                harvestTraceLinks.harvestOperationId,
                harvestTraceLinks.raisedBedFieldId,
                harvestTraceLinks.plantPlaceEventId,
            ],
        })
        .returning();

    if (inserted) {
        return inserted;
    }

    const racedExisting = await storage().query.harvestTraceLinks.findFirst({
        where: and(
            eq(harvestTraceLinks.harvestOperationId, input.harvestOperationId),
            eq(harvestTraceLinks.raisedBedFieldId, input.raisedBedFieldId),
            eq(harvestTraceLinks.plantPlaceEventId, input.plantPlaceEventId),
        ),
    });
    if (!racedExisting) {
        throw new Error('Failed to create harvest trace link.');
    }

    return racedExisting;
}

export async function getPublicHarvestTraceByToken(tokenValue: string) {
    const token = normalizeHarvestTraceToken(tokenValue);
    if (!token) {
        return null;
    }

    const target = await getTraceTargetByToken(token, ['active']);
    if (!target) {
        return null;
    }

    return buildPublicTrace(target);
}

function normalizeUserAgentFamily(value: string | null | undefined) {
    const userAgent = value?.toLowerCase();
    if (!userAgent) {
        return null;
    }

    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
        return 'bot';
    }
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        return 'ios';
    }
    if (userAgent.includes('android')) {
        return 'android';
    }
    if (userAgent.includes('mobile')) {
        return 'mobile';
    }

    return 'desktop';
}

export async function recordHarvestTraceScan(
    tokenValue: string,
    input: { userAgent?: string | null } = {},
) {
    const token = normalizeHarvestTraceToken(tokenValue);
    if (!token) {
        return null;
    }

    const link = await storage().query.harvestTraceLinks.findFirst({
        where: and(
            eq(harvestTraceLinks.publicToken, token),
            eq(harvestTraceLinks.status, 'active'),
        ),
        columns: { id: true },
    });
    if (!link) {
        return null;
    }

    const [scan] = await storage()
        .insert(harvestTraceScans)
        .values({
            harvestTraceLinkId: link.id,
            userAgentFamily: normalizeUserAgentFamily(input.userAgent),
        })
        .returning();

    return scan ?? null;
}

async function getScanStatsForLinkIds(linkIds: number[]) {
    if (linkIds.length === 0) {
        return new Map<number, ScanStats>();
    }

    const rows = await storage()
        .select({
            harvestTraceLinkId: harvestTraceScans.harvestTraceLinkId,
            scanCount: count(),
            firstScannedAt: sql<Date | null>`min(${harvestTraceScans.scannedAt})`,
            lastScannedAt: sql<Date | null>`max(${harvestTraceScans.scannedAt})`,
        })
        .from(harvestTraceScans)
        .where(inArray(harvestTraceScans.harvestTraceLinkId, linkIds))
        .groupBy(harvestTraceScans.harvestTraceLinkId);

    return new Map(
        rows.map((row) => [
            row.harvestTraceLinkId,
            {
                scanCount: row.scanCount,
                firstScannedAt: row.firstScannedAt,
                lastScannedAt: row.lastScannedAt,
            },
        ]),
    );
}

async function getAdminSummaryRows(filter: HarvestTraceLinkAdminFilter = {}) {
    const query = filter.query?.trim();
    const tokenFromUrl = query?.split('/').filter(Boolean).at(-1);
    const normalizedToken = normalizeHarvestTraceToken(tokenFromUrl);
    const queryPattern = query ? `%${query}%` : undefined;
    const statusFilter =
        filter.status && filter.status !== 'all'
            ? eq(harvestTraceLinks.status, filter.status)
            : undefined;
    const searchFilter = queryPattern
        ? normalizedToken
            ? or(
                  like(harvestTraceLinks.publicToken, queryPattern),
                  sql`${raisedBeds.physicalId} ilike ${queryPattern}`,
                  eq(harvestTraceLinks.publicToken, normalizedToken),
              )
            : or(
                  like(harvestTraceLinks.publicToken, queryPattern),
                  sql`${raisedBeds.physicalId} ilike ${queryPattern}`,
              )
        : undefined;
    const scanStateFilter =
        filter.scanState === 'scanned'
            ? sql`exists (
                  select 1
                  from ${harvestTraceScans}
                  where ${harvestTraceScans.harvestTraceLinkId} = ${harvestTraceLinks.id}
              )`
            : filter.scanState === 'not-scanned'
              ? sql`not exists (
                    select 1
                    from ${harvestTraceScans}
                    where ${harvestTraceScans.harvestTraceLinkId} = ${harvestTraceLinks.id}
                )`
              : undefined;

    return storage()
        .select({
            link: harvestTraceLinks,
            raisedBedName: raisedBeds.name,
            raisedBedPhysicalId: raisedBeds.physicalId,
            actualFieldPositionIndex: raisedBedFields.positionIndex,
        })
        .from(harvestTraceLinks)
        .innerJoin(raisedBeds, eq(harvestTraceLinks.raisedBedId, raisedBeds.id))
        .innerJoin(
            raisedBedFields,
            eq(harvestTraceLinks.raisedBedFieldId, raisedBedFields.id),
        )
        .where(and(statusFilter, searchFilter, scanStateFilter))
        .orderBy(desc(harvestTraceLinks.createdAt), desc(harvestTraceLinks.id))
        .limit(Math.min(Math.max(filter.limit ?? 100, 1), 250));
}

async function toAdminSummaries(
    rows: HarvestTraceTargetRow[],
): Promise<HarvestTraceLinkAdminSummary[]> {
    const [plantSorts, operationEntities, scanStats] = await Promise.all([
        getEntitiesFormatted<EntityStandardized>('plantSort'),
        getEntitiesFormatted<EntityStandardized>('operation'),
        getScanStatsForLinkIds(rows.map((row) => row.link.id)),
    ]);
    const operationIds = rows.flatMap((row) =>
        row.link.harvestOperationId ? [row.link.harvestOperationId] : [],
    );
    const operationRows = await getOperationsByIds(operationIds);
    const operationsById = new Map(
        operationRows.map((operation) => [operation.id, operation]),
    );

    return rows.map((row) => {
        const stats = scanStats.get(row.link.id) ?? {
            scanCount: 0,
            firstScannedAt: null,
            lastScannedAt: null,
        };
        const plantSort = findEntityById(plantSorts, row.link.plantSortId);
        const harvestOperation = row.link.harvestOperationId
            ? operationsById.get(row.link.harvestOperationId)
            : undefined;
        const harvestEntity = findEntityById(
            operationEntities,
            harvestOperation?.entityId,
        );

        return {
            id: row.link.id,
            publicToken: row.link.publicToken,
            status: row.link.status,
            publicPath: row.link.tracePath,
            plantSortName: entityName(
                plantSort,
                row.link.plantSortId
                    ? `Sorta #${row.link.plantSortId}`
                    : 'Nepoznata sorta',
            ),
            raisedBedName: row.raisedBedName,
            raisedBedPhysicalId: row.raisedBedPhysicalId,
            fieldLabel: row.link.fieldLabel,
            harvestLabel: entityName(harvestEntity, 'Berba'),
            harvestOperationId: row.link.harvestOperationId,
            raisedBedId: row.link.raisedBedId,
            raisedBedFieldId: row.link.raisedBedFieldId,
            gardenId: row.link.gardenId,
            accountId: row.link.accountId,
            createdAt: row.link.createdAt,
            updatedAt: row.link.updatedAt,
            printedAt: row.link.printedAt,
            revokedAt: row.link.revokedAt,
            scanCount: stats.scanCount,
            firstScannedAt: stats.firstScannedAt,
            lastScannedAt: stats.lastScannedAt,
        };
    });
}

export async function getHarvestTraceLinksAdmin(
    filter: HarvestTraceLinkAdminFilter = {},
) {
    const rows = await getAdminSummaryRows(filter);
    return toAdminSummaries(rows);
}

export async function getHarvestTraceLinkAdminDetail(id: number) {
    requirePositiveInteger(id, 'id');

    const target = await getTraceTargetById(id);
    if (!target) {
        return null;
    }

    const [summary] = await toAdminSummaries([target]);
    if (!summary) {
        return null;
    }

    return {
        ...summary,
        plantPlaceEventId: target.link.plantPlaceEventId,
        plantSortId: target.link.plantSortId,
        fieldPositionIndex: target.link.fieldPositionIndex,
        timeline:
            target.link.status === 'active'
                ? await buildPublicTrace(target)
                : null,
    } satisfies HarvestTraceLinkAdminDetail;
}

export async function updateHarvestTraceLinkStatus(
    id: number,
    status: HarvestTraceLinkStatus,
) {
    requirePositiveInteger(id, 'id');
    const now = new Date();

    const [updated] = await storage()
        .update(harvestTraceLinks)
        .set({
            status,
            revokedAt: status === 'revoked' ? now : null,
            updatedAt: now,
        })
        .where(eq(harvestTraceLinks.id, id))
        .returning();

    return updated ?? null;
}

export async function markHarvestTraceLinksPrinted(linkIds: number[]) {
    const uniqueIds = Array.from(
        new Set(linkIds.filter((id) => positiveInteger(id))),
    );
    if (uniqueIds.length === 0) {
        return 0;
    }

    const now = new Date();
    const rows = await storage()
        .update(harvestTraceLinks)
        .set({ printedAt: now, updatedAt: now })
        .where(inArray(harvestTraceLinks.id, uniqueIds))
        .returning({ id: harvestTraceLinks.id });

    return rows.length;
}

export async function getFarmUserPrintableHarvestTraceLinkIds(
    userId: string,
    linkIds: number[],
) {
    const uniqueIds = Array.from(
        new Set(linkIds.filter((id) => positiveInteger(id))),
    );
    if (uniqueIds.length === 0) {
        return [];
    }

    const rows = await storage()
        .select({ id: harvestTraceLinks.id })
        .from(harvestTraceLinks)
        .innerJoin(gardens, eq(harvestTraceLinks.gardenId, gardens.id))
        .innerJoin(farmUsers, eq(gardens.farmId, farmUsers.farmId))
        .innerJoin(raisedBeds, eq(harvestTraceLinks.raisedBedId, raisedBeds.id))
        .innerJoin(
            operations,
            eq(harvestTraceLinks.harvestOperationId, operations.id),
        )
        .where(
            and(
                inArray(harvestTraceLinks.id, uniqueIds),
                eq(farmUsers.userId, userId),
                eq(gardens.isDeleted, false),
                eq(gardens.isSandbox, false),
                eq(raisedBeds.isDeleted, false),
                eq(operations.isAccepted, true),
                eq(operations.isDeleted, false),
                eq(operations.raisedBedId, harvestTraceLinks.raisedBedId),
                or(
                    isNull(operations.raisedBedFieldId),
                    eq(
                        operations.raisedBedFieldId,
                        harvestTraceLinks.raisedBedFieldId,
                    ),
                ),
            ),
        );

    return rows.map((row) => row.id);
}

export async function getHarvestTraceLinksForTarget(input: {
    harvestOperationId: number;
    raisedBedFieldId?: number;
    from?: Date;
    to?: Date;
}) {
    requirePositiveInteger(input.harvestOperationId, 'harvestOperationId');

    return storage().query.harvestTraceLinks.findMany({
        where: and(
            eq(harvestTraceLinks.harvestOperationId, input.harvestOperationId),
            input.raisedBedFieldId
                ? eq(harvestTraceLinks.raisedBedFieldId, input.raisedBedFieldId)
                : undefined,
            input.from
                ? gte(harvestTraceLinks.createdAt, input.from)
                : undefined,
            input.to ? lte(harvestTraceLinks.createdAt, input.to) : undefined,
        ),
        orderBy: [desc(harvestTraceLinks.createdAt)],
    });
}
