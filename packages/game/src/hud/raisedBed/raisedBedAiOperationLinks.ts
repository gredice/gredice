const PUBLIC_OPERATION_HOST = 'www.gredice.com';
const PUBLIC_OPERATION_PATH_PREFIX = '/radnje/';
const LEGACY_AI_OPERATION_LINK_PATH_PREFIX = '/garden/operation/';

export type RaisedBedAiOperationLinkTarget = {
    operationId?: number;
    operationSlug?: string;
    raisedBedId: number;
    positionIndex?: number;
    scheduledDate?: string;
};

function parsePositiveInteger(value: string | null) {
    if (!value || !/^\d+$/.test(value)) {
        return null;
    }

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeInteger(value: string | null) {
    if (!value || !/^\d+$/.test(value)) {
        return null;
    }

    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseCalendarDate(value: string | null) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
        ? value
        : null;
}

export function buildRaisedBedAiOperationHref({
    operationSlug,
    raisedBedId,
    positionIndex,
    scheduledDate,
}: RaisedBedAiOperationLinkTarget) {
    if (!operationSlug) {
        return null;
    }

    const hash = new URLSearchParams({
        raisedBedId: String(raisedBedId),
    });

    if (typeof positionIndex === 'number') {
        hash.set('positionIndex', String(positionIndex));
    }

    const validScheduledDate = parseCalendarDate(scheduledDate ?? null);
    if (validScheduledDate) {
        hash.set('scheduledDate', validScheduledDate);
    }

    return `https://${PUBLIC_OPERATION_HOST}${PUBLIC_OPERATION_PATH_PREFIX}${operationSlug}#${hash.toString()}`;
}

export function parseRaisedBedAiOperationHref(
    href: string | undefined,
): RaisedBedAiOperationLinkTarget | null {
    if (!href) {
        return null;
    }

    let url: URL;
    try {
        url = new URL(href, 'https://garden.gredice.local');
    } catch {
        return null;
    }

    const hash = new URLSearchParams(
        url.hash.startsWith('#') ? url.hash.slice(1) : url.hash,
    );
    const raisedBedId = parsePositiveInteger(hash.get('raisedBedId'));

    if (!raisedBedId) {
        return null;
    }

    const rawPositionIndex =
        hash.get('positionIndex') ?? hash.get('plantFieldIndex');

    const positionIndex =
        rawPositionIndex === null
            ? undefined
            : parseNonNegativeInteger(rawPositionIndex);
    if (positionIndex === null) {
        return null;
    }

    const rawScheduledDate = hash.get('scheduledDate') ?? hash.get('date');
    const scheduledDate =
        rawScheduledDate === null
            ? undefined
            : (parseCalendarDate(rawScheduledDate) ?? undefined);

    if (
        url.hostname === PUBLIC_OPERATION_HOST &&
        url.pathname.startsWith(PUBLIC_OPERATION_PATH_PREFIX)
    ) {
        const operationSlug = decodeURIComponent(
            url.pathname
                .slice(PUBLIC_OPERATION_PATH_PREFIX.length)
                .replace(/\/$/, ''),
        );

        if (!operationSlug) {
            return null;
        }

        return {
            operationSlug,
            raisedBedId,
            ...(typeof positionIndex === 'number' ? { positionIndex } : {}),
            ...(scheduledDate ? { scheduledDate } : {}),
        };
    }

    if (url.pathname.startsWith(LEGACY_AI_OPERATION_LINK_PATH_PREFIX)) {
        const operationId = parsePositiveInteger(
            url.pathname.slice(LEGACY_AI_OPERATION_LINK_PATH_PREFIX.length),
        );

        if (!operationId) {
            return null;
        }

        return {
            operationId,
            raisedBedId,
            ...(typeof positionIndex === 'number' ? { positionIndex } : {}),
            ...(scheduledDate ? { scheduledDate } : {}),
        };
    }

    return null;
}
