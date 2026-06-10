import { clientAuthenticated } from '@gredice/client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useCurrentGarden } from './useCurrentGarden';

const DEFAULT_PAGE_SIZE = 20;

const backendStatusMap: Record<string, GardenOperationStatus> = {
    new: 'new',
    planned: 'planned',
    assigned: 'assigned',
    pendingVerification: 'confirmed',
    confirmed: 'confirmed',
    completed: 'completed',
    failed: 'failed',
    canceled: 'canceled',
};

export type GardenOperationStatus =
    | 'new'
    | 'planned'
    | 'assigned'
    | 'confirmed'
    | 'completed'
    | 'failed'
    | 'canceled';

export type GardenOperationItem = {
    id: number;
    entityId: number;
    entityTypeName: string;
    raisedBedId: number | null;
    raisedBedFieldId: number | null;
    status: GardenOperationStatus;
    createdAt: string;
    scheduledDate: string | null;
    scheduledAt: string | null;
    completedAt: string | null;
    verifiedAt: string | null;
    canceledAt: string | null;
    imageUrls: string[];
    completionNotes: string | null;
    targetLabel: string;
    statusHistory: {
        status: GardenOperationStatus;
        changedAt: string;
    }[];
};

type GardenOperationsScope = {
    raisedBedId?: number;
    raisedBedFieldId?: number;
    positionIndex?: number;
};

type GardenOperationsPage = {
    items: GardenOperationItem[];
    nextCursor: number | null;
    total: number;
};

type GardenOperationItemResponse = Omit<
    GardenOperationItem,
    | 'completionNotes'
    | 'entityTypeName'
    | 'imageUrls'
    | 'status'
    | 'statusHistory'
> & {
    completionNotes?: string | null;
    entityTypeName?: string;
    imageUrls?: string[] | null;
    status: string;
    statusHistory: ({
        status: string;
        changedAt: string;
    } | null)[];
};

type GardenOperationsPageResponse = Omit<GardenOperationsPage, 'items'> & {
    items: GardenOperationItemResponse[];
};

function parseGardenOperationStatus(status: string): GardenOperationStatus {
    const mapped = backendStatusMap[status];
    if (!mapped) {
        throw new Error(`Unknown garden operation status: ${status}`);
    }

    return mapped;
}

function parseGardenOperationItem(
    item: GardenOperationItemResponse,
): GardenOperationItem {
    return {
        ...item,
        completionNotes: item.completionNotes ?? null,
        entityTypeName: item.entityTypeName ?? 'operation',
        imageUrls: item.imageUrls ?? [],
        status: parseGardenOperationStatus(item.status),
        statusHistory: item.statusHistory.flatMap((entry) => {
            if (!entry) {
                return [];
            }

            return [
                {
                    status: parseGardenOperationStatus(entry.status),
                    changedAt: entry.changedAt,
                },
            ];
        }),
    };
}

function parseGardenOperationsPage(
    page: GardenOperationsPageResponse,
): GardenOperationsPage {
    return {
        items: page.items.map(parseGardenOperationItem),
        nextCursor: page.nextCursor,
        total: page.total,
    };
}

async function getGardenOperationsPage(
    input: {
        gardenId: number;
        includeCompleted: boolean;
        pageSize: number;
        cursor: number;
    } & GardenOperationsScope,
): Promise<GardenOperationsPage> {
    const response = await clientAuthenticated().api.gardens[
        ':gardenId'
    ].operations.$get({
        param: {
            gardenId: input.gardenId.toString(),
        },
        query: {
            cursor: input.cursor.toString(),
            limit: input.pageSize.toString(),
            includeCompleted: input.includeCompleted.toString(),
            ...(input.raisedBedId !== undefined
                ? { raisedBedId: input.raisedBedId.toString() }
                : {}),
            ...(input.raisedBedFieldId !== undefined
                ? { raisedBedFieldId: input.raisedBedFieldId.toString() }
                : {}),
            ...(input.positionIndex !== undefined
                ? { positionIndex: input.positionIndex.toString() }
                : {}),
        },
    });

    if (response.status !== 200) {
        throw new Error('Failed to fetch garden operations');
    }

    return parseGardenOperationsPage(await response.json());
}

export function gardenOperationsQueryKey({
    gardenId,
    includeCompleted,
    pageSize,
    raisedBedId,
    raisedBedFieldId,
    positionIndex,
}: {
    gardenId: number | undefined;
    includeCompleted: boolean;
    pageSize: number;
} & GardenOperationsScope) {
    return [
        'garden-operations',
        gardenId,
        includeCompleted,
        pageSize,
        raisedBedId ?? null,
        raisedBedFieldId ?? null,
        positionIndex ?? null,
    ] as const;
}

export function useGardenOperations({
    enabled = true,
    includeCompleted,
    pageSize = DEFAULT_PAGE_SIZE,
    raisedBedId,
    raisedBedFieldId,
    positionIndex,
}: {
    enabled?: boolean;
    includeCompleted: boolean;
    pageSize?: number;
} & GardenOperationsScope) {
    const { data: currentGarden } = useCurrentGarden();

    return useInfiniteQuery({
        queryKey: gardenOperationsQueryKey({
            gardenId: currentGarden?.id,
            includeCompleted,
            pageSize,
            raisedBedId,
            raisedBedFieldId,
            positionIndex,
        }),
        queryFn: async ({ pageParam }) => {
            if (!currentGarden?.id) {
                return {
                    items: [],
                    nextCursor: null,
                    total: 0,
                } satisfies GardenOperationsPage;
            }

            return getGardenOperationsPage({
                gardenId: currentGarden.id,
                includeCompleted,
                pageSize,
                raisedBedId,
                raisedBedFieldId,
                positionIndex,
                cursor: pageParam,
            });
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        enabled: Boolean(currentGarden?.id) && enabled,
    });
}
