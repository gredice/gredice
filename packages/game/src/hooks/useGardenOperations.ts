import { clientAuthenticated } from '@gredice/client';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
    isOperationVisualRewardDebugProfile,
    operationVisualRewardDebugOperationItems,
} from '../operationVisualRewardDebugProfile';
import { useGameState } from '../useGameState';
import {
    type GardenOperationStatus,
    parseGardenOperationStatus,
} from './gardenOperationStatus';
import { useCurrentGarden } from './useCurrentGarden';

export type { GardenOperationStatus } from './gardenOperationStatus';

const DEFAULT_PAGE_SIZE = 20;

export type GardenOperationItem = {
    id: number;
    entityId: number;
    taskVersionEventId: number | null;
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
    cancellationReason: string | null;
    blockedAt: string | null;
    blockReasonLabel: string | null;
    blockNote: string | null;
    blockImageUrls: string[];
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

type CurrentGardenData = NonNullable<
    NonNullable<ReturnType<typeof useCurrentGarden>['data']>
>;

type GardenOperationItemResponse = Omit<
    GardenOperationItem,
    | 'completionNotes'
    | 'blockedAt'
    | 'blockImageUrls'
    | 'blockNote'
    | 'blockReasonLabel'
    | 'cancellationReason'
    | 'entityTypeName'
    | 'imageUrls'
    | 'status'
    | 'statusHistory'
    | 'taskVersionEventId'
> & {
    completionNotes?: string | null;
    blockedAt?: string | null;
    blockImageUrls?: string[] | null;
    blockNote?: string | null;
    blockReasonLabel?: string | null;
    entityTypeName?: string;
    imageUrls?: string[] | null;
    status: string;
    taskVersionEventId?: number | null;
    cancellationReason?: string | null;
    statusHistory: ({
        status: string;
        changedAt: string;
    } | null)[];
};

type GardenOperationsPageResponse = Omit<GardenOperationsPage, 'items'> & {
    items: GardenOperationItemResponse[];
};

function parseGardenOperationItem(
    item: GardenOperationItemResponse,
): GardenOperationItem {
    return {
        ...item,
        completionNotes: item.completionNotes ?? null,
        blockedAt: item.blockedAt ?? null,
        blockImageUrls: item.blockImageUrls ?? [],
        blockNote: item.blockNote ?? null,
        blockReasonLabel: item.blockReasonLabel ?? null,
        cancellationReason: item.cancellationReason ?? null,
        entityTypeName: item.entityTypeName ?? 'operation',
        imageUrls: item.imageUrls ?? [],
        taskVersionEventId: item.taskVersionEventId ?? null,
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
            includeCompleted: input.includeCompleted ? 'true' : 'false',
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
    profile,
    raisedBedId,
    raisedBedFieldId,
    positionIndex,
}: {
    gardenId: number | undefined;
    includeCompleted: boolean;
    pageSize: number;
    profile?: string | null;
} & GardenOperationsScope) {
    return [
        'garden-operations',
        gardenId,
        profile ?? null,
        includeCompleted,
        pageSize,
        raisedBedId ?? null,
        raisedBedFieldId ?? null,
        positionIndex ?? null,
    ] as const;
}

function fieldIdsForPositionIndex({
    currentGarden,
    positionIndex,
    raisedBedId,
}: {
    currentGarden: CurrentGardenData;
    positionIndex: number;
    raisedBedId?: number;
}) {
    return currentGarden.raisedBeds
        .filter((raisedBed) =>
            raisedBedId == null ? true : raisedBed.id === raisedBedId,
        )
        .flatMap((raisedBed) =>
            raisedBed.fields
                .filter((field) => field.positionIndex === positionIndex)
                .map((field) => field.id),
        );
}

function getOperationVisualRewardDebugOperationsPage({
    currentGarden,
    cursor,
    includeCompleted,
    pageSize,
    positionIndex,
    raisedBedFieldId,
    raisedBedId,
}: {
    currentGarden: CurrentGardenData;
    cursor: number;
    includeCompleted: boolean;
    pageSize: number;
} & GardenOperationsScope): GardenOperationsPage {
    if (!includeCompleted) {
        return {
            items: [],
            nextCursor: null,
            total: 0,
        };
    }

    const fieldIds =
        positionIndex == null
            ? null
            : new Set(
                  fieldIdsForPositionIndex({
                      currentGarden,
                      positionIndex,
                      raisedBedId,
                  }),
              );
    const matchingItems = operationVisualRewardDebugOperationItems.filter(
        (item) => {
            if (raisedBedId != null && item.raisedBedId !== raisedBedId) {
                return false;
            }

            if (
                raisedBedFieldId != null &&
                item.raisedBedFieldId !== raisedBedFieldId
            ) {
                return false;
            }

            if (
                fieldIds &&
                (item.raisedBedFieldId == null ||
                    !fieldIds.has(item.raisedBedFieldId))
            ) {
                return false;
            }

            return true;
        },
    );
    const items = matchingItems.slice(cursor, cursor + pageSize);
    const nextCursor =
        cursor + pageSize < matchingItems.length ? cursor + pageSize : null;

    return {
        items,
        nextCursor,
        total: matchingItems.length,
    };
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
    const isMock = useGameState((state) => state.isMock);
    const mockGardenProfile = useGameState((state) => state.mockGardenProfile);
    const isOperationRewardDebug =
        isMock && isOperationVisualRewardDebugProfile(mockGardenProfile);

    return useInfiniteQuery({
        queryKey: gardenOperationsQueryKey({
            gardenId: currentGarden?.id,
            includeCompleted,
            pageSize,
            profile: isOperationRewardDebug ? mockGardenProfile : null,
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

            if (isOperationRewardDebug) {
                return getOperationVisualRewardDebugOperationsPage({
                    currentGarden,
                    includeCompleted,
                    pageSize,
                    raisedBedId,
                    raisedBedFieldId,
                    positionIndex,
                    cursor: pageParam,
                });
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
