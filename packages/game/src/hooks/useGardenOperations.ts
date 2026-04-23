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
    raisedBedId: number | null;
    raisedBedFieldId: number | null;
    status: GardenOperationStatus;
    createdAt: string;
    scheduledDate: string | null;
    scheduledAt: string | null;
    completedAt: string | null;
    verifiedAt: string | null;
    canceledAt: string | null;
    targetLabel: string;
    statusHistory: {
        status: GardenOperationStatus;
        changedAt: string;
    }[];
};

type GardenOperationsPage = {
    items: GardenOperationItem[];
    nextCursor: number | null;
    total: number;
};

type GardenOperationItemResponse = Omit<
    GardenOperationItem,
    'status' | 'statusHistory'
> & {
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

async function getGardenOperationsPage(input: {
    gardenId: number;
    includeCompleted: boolean;
    pageSize: number;
    cursor: number;
}): Promise<GardenOperationsPage> {
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
        },
    });

    if (response.status !== 200) {
        throw new Error('Failed to fetch garden operations');
    }

    return parseGardenOperationsPage(await response.json());
}

export function useGardenOperations({
    includeCompleted,
    pageSize = DEFAULT_PAGE_SIZE,
}: {
    includeCompleted: boolean;
    pageSize?: number;
}) {
    const { data: currentGarden } = useCurrentGarden();

    return useInfiniteQuery({
        queryKey: [
            'garden-operations',
            currentGarden?.id,
            includeCompleted,
            pageSize,
        ],
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
                cursor: pageParam,
            });
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        enabled: Boolean(currentGarden?.id),
    });
}
