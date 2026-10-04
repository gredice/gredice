import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys as raisedBedAiHistoryQueryKeys } from '../hooks/useRaisedBedAiHistory';
import { queryKeys as raisedBedDiaryQueryKeys } from '../hooks/useRaisedBedDiaryEntries';
import { useShoppingCartQueryKey } from '../hooks/useShoppingCart';
import { tutorialChecklistKeys } from '../hooks/useTutorialChecklist';

const shoppingCartMutationTools = new Set([
    'addProductToCart',
    'addOperationToCart',
    'updateCartItem',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function completedToolName(part: unknown) {
    if (!isRecord(part) || part.state !== 'output-available') {
        return null;
    }

    const type = typeof part.type === 'string' ? part.type : '';
    if (type === 'dynamic-tool') {
        return typeof part.toolName === 'string' ? part.toolName : null;
    }

    return type.startsWith('tool-') ? type.replace(/^tool-/, '') : null;
}

function raisedBedIdFromToolPart(
    part: Record<string, unknown>,
    fallbackRaisedBedId: number | null,
) {
    const input = isRecord(part.input) ? part.input : null;
    const raisedBedId = input?.raisedBedId;
    return typeof raisedBedId === 'number' && Number.isInteger(raisedBedId)
        ? raisedBedId
        : fallbackRaisedBedId;
}

export function suncokretMutationQueryKeys({
    fallbackRaisedBedId = null,
    message,
}: {
    fallbackRaisedBedId?: number | null;
    message: { parts: readonly unknown[] };
}) {
    let shoppingCartChanged = false;
    const analyzedRaisedBedIds = new Set<number>();

    for (const part of message.parts) {
        const name = completedToolName(part);
        if (!name || !isRecord(part)) {
            continue;
        }

        if (shoppingCartMutationTools.has(name)) {
            shoppingCartChanged = true;
        }

        if (name === 'analyzeRaisedBedImages') {
            const raisedBedId = raisedBedIdFromToolPart(
                part,
                fallbackRaisedBedId,
            );
            if (raisedBedId !== null) {
                analyzedRaisedBedIds.add(raisedBedId);
            }
        }
    }

    const queryKeys: QueryKey[] = [];
    if (shoppingCartChanged) {
        queryKeys.push(useShoppingCartQueryKey, tutorialChecklistKeys);
    }
    for (const raisedBedId of analyzedRaisedBedIds) {
        queryKeys.push(
            raisedBedDiaryQueryKeys.byId(raisedBedId),
            raisedBedAiHistoryQueryKeys.byId(raisedBedId),
        );
    }

    return queryKeys;
}

export async function invalidateSuncokretMutationQueries({
    fallbackRaisedBedId,
    message,
    queryClient,
}: {
    fallbackRaisedBedId?: number | null;
    message: { parts: readonly unknown[] };
    queryClient: QueryClient;
}) {
    await Promise.all(
        suncokretMutationQueryKeys({ fallbackRaisedBedId, message }).map(
            (queryKey) => queryClient.invalidateQueries({ queryKey }),
        ),
    );
}
