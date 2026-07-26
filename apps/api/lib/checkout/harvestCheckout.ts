import type { CheckoutDeliverySelection } from './deliverySelection';

const harvestDatesMetadataVersion = '1';
const harvestDatesMetadataChunkSize = 450;
const harvestDatePattern = /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/u;

export interface CanonicalHarvestDateSelection {
    cartItemId: number;
    scheduledDate: string;
}

function parseAdditionalData(value: string | null | undefined) {
    if (!value) {
        return {};
    }

    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Shopping cart item additional data must be an object');
    }

    return parsed;
}

export function buildCheckoutAdditionalData({
    additionalData,
    deliveryInfo,
    scheduledHarvestDate,
}: {
    additionalData: string | null | undefined;
    deliveryInfo?: CheckoutDeliverySelection;
    scheduledHarvestDate?: string;
}) {
    return {
        ...parseAdditionalData(additionalData),
        ...(scheduledHarvestDate
            ? { scheduledDate: scheduledHarvestDate }
            : {}),
        ...(deliveryInfo ? { delivery: deliveryInfo } : {}),
    };
}

function isCanonicalHarvestDate(value: unknown): value is string {
    if (typeof value !== 'string' || !harvestDatePattern.test(value)) {
        return false;
    }

    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

export function encodeHarvestDatesMetadata(
    selections: readonly CanonicalHarvestDateSelection[],
    expectedNonStripeCartItemIds: readonly number[] = [],
) {
    const entries: Array<readonly [number, string]> = [];
    const seenCartItemIds = new Set<number>();
    for (const selection of [...selections].sort(
        (first, second) => first.cartItemId - second.cartItemId,
    )) {
        if (
            !Number.isInteger(selection.cartItemId) ||
            selection.cartItemId <= 0 ||
            seenCartItemIds.has(selection.cartItemId) ||
            !isCanonicalHarvestDate(selection.scheduledDate)
        ) {
            throw new Error('Invalid canonical harvest date metadata');
        }

        seenCartItemIds.add(selection.cartItemId);
        entries.push([selection.cartItemId, selection.scheduledDate]);
    }

    const chunks: string[] = [];
    let currentChunk: Array<readonly [number, string]> = [];
    for (const entry of entries) {
        const candidate = [...currentChunk, entry];
        const serializedCandidate = JSON.stringify(candidate);

        if (
            currentChunk.length > 0 &&
            serializedCandidate.length > harvestDatesMetadataChunkSize
        ) {
            chunks.push(JSON.stringify(currentChunk));
            currentChunk = [entry];
        } else {
            currentChunk = candidate;
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(JSON.stringify(currentChunk));
    }

    const expectedIds = [
        ...new Set(
            [...expectedNonStripeCartItemIds].sort(
                (first, second) => first - second,
            ),
        ),
    ];
    if (
        expectedIds.length !== expectedNonStripeCartItemIds.length ||
        expectedIds.some((id) => !Number.isInteger(id) || id <= 0)
    ) {
        throw new Error('Invalid non-Stripe cart item metadata');
    }
    const expectedIdChunks: string[] = [];
    let currentExpectedIdChunk: number[] = [];
    for (const id of expectedIds) {
        const candidate = [...currentExpectedIdChunk, id];
        if (
            currentExpectedIdChunk.length > 0 &&
            JSON.stringify(candidate).length > harvestDatesMetadataChunkSize
        ) {
            expectedIdChunks.push(JSON.stringify(currentExpectedIdChunk));
            currentExpectedIdChunk = [id];
        } else {
            currentExpectedIdChunk = candidate;
        }
    }
    if (currentExpectedIdChunk.length > 0) {
        expectedIdChunks.push(JSON.stringify(currentExpectedIdChunk));
    }

    return Object.fromEntries([
        ['harvestDatesVersion', harvestDatesMetadataVersion],
        ['harvestDatesChunkCount', chunks.length.toString()],
        ['nonStripeCartItemIdsChunkCount', expectedIdChunks.length.toString()],
        ...chunks.map(
            (chunk, index) =>
                [`harvestDates${index.toString()}`, chunk] as const,
        ),
        ...expectedIdChunks.map(
            (chunk, index) =>
                [`nonStripeCartItemIds${index.toString()}`, chunk] as const,
        ),
    ]);
}

export function decodeHarvestDatesMetadata(
    metadata: Record<string, unknown> | null | undefined,
) {
    const version = metadata?.harvestDatesVersion;
    const chunkCountValue = metadata?.harvestDatesChunkCount;
    if (version === undefined && chunkCountValue === undefined) {
        return new Map<number, string>();
    }
    if (
        version !== harvestDatesMetadataVersion ||
        typeof chunkCountValue !== 'string' ||
        !/^(?:0|[1-9]\d?)$/u.test(chunkCountValue)
    ) {
        throw new Error('Invalid harvest date checkout metadata');
    }

    const chunkCount = Number.parseInt(chunkCountValue, 10);
    const selections = new Map<number, string>();
    for (let index = 0; index < chunkCount; index += 1) {
        const chunk = metadata?.[`harvestDates${index.toString()}`];
        if (typeof chunk !== 'string') {
            throw new Error('Incomplete harvest date checkout metadata');
        }

        const entries: unknown = JSON.parse(chunk);
        if (!Array.isArray(entries)) {
            throw new Error('Invalid harvest date checkout metadata chunk');
        }

        for (const entry of entries) {
            if (
                !Array.isArray(entry) ||
                entry.length !== 2 ||
                !Number.isInteger(entry[0]) ||
                entry[0] <= 0 ||
                !isCanonicalHarvestDate(entry[1]) ||
                selections.has(entry[0])
            ) {
                throw new Error('Invalid harvest date checkout metadata entry');
            }
            selections.set(entry[0], entry[1]);
        }
    }

    return selections;
}

export function decodeExpectedNonStripeCartItemIdsMetadata(
    metadata: Record<string, unknown> | null | undefined,
) {
    const version = metadata?.harvestDatesVersion;
    const chunkCountValue = metadata?.nonStripeCartItemIdsChunkCount;
    if (version === undefined && chunkCountValue === undefined) {
        return null;
    }
    if (
        version !== harvestDatesMetadataVersion ||
        typeof chunkCountValue !== 'string' ||
        !/^(?:0|[1-9]\d?)$/u.test(chunkCountValue)
    ) {
        throw new Error('Invalid non-Stripe cart item checkout metadata');
    }

    const chunkCount = Number.parseInt(chunkCountValue, 10);
    const cartItemIds = new Set<number>();
    for (let index = 0; index < chunkCount; index += 1) {
        const chunk = metadata?.[`nonStripeCartItemIds${index.toString()}`];
        if (typeof chunk !== 'string') {
            throw new Error(
                'Incomplete non-Stripe cart item checkout metadata',
            );
        }

        const entries: unknown = JSON.parse(chunk);
        if (!Array.isArray(entries)) {
            throw new Error(
                'Invalid non-Stripe cart item checkout metadata chunk',
            );
        }
        for (const entry of entries) {
            if (
                !Number.isInteger(entry) ||
                entry <= 0 ||
                cartItemIds.has(entry)
            ) {
                throw new Error(
                    'Invalid non-Stripe cart item checkout metadata entry',
                );
            }
            cartItemIds.add(entry);
        }
    }

    return cartItemIds;
}
