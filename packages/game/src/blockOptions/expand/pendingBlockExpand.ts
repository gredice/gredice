import {
    type GardenBlockBatchPurchaseBody,
    parseGardenBlockBatchPurchaseBody,
} from '@gredice/client';

/**
 * An Expand batch whose response never arrived. It is kept until the same
 * request is checked again (the server replays it without a second debit)
 * or the player discards it, also across a reload of the tab.
 */
export type PendingBlockExpand = {
    gardenId: number;
    body: GardenBlockBatchPurchaseBody;
};

export type PendingBlockExpandStorage = Pick<
    Storage,
    'getItem' | 'setItem' | 'removeItem'
>;

export function getPendingBlockExpandKey(userId: string, gardenId: number) {
    return `gredice:pending-block-expand:${JSON.stringify([userId, gardenId])}`;
}

function getSessionStorage(): PendingBlockExpandStorage | null {
    try {
        return typeof sessionStorage === 'undefined' ? null : sessionStorage;
    } catch {
        // Storage access can throw (blocked site data, sandboxed frames).
        return null;
    }
}

/**
 * The pending command of this user's garden, validated with the batch
 * contract schema; null when there is none or it is not valid.
 */
export function readPendingBlockExpand(
    userId: string,
    gardenId: number,
    storage: PendingBlockExpandStorage | null = getSessionStorage(),
): PendingBlockExpand | null {
    if (!storage) {
        return null;
    }

    try {
        const raw: unknown = JSON.parse(
            storage.getItem(getPendingBlockExpandKey(userId, gardenId)) ??
                'null',
        );
        if (
            !raw ||
            typeof raw !== 'object' ||
            !('gardenId' in raw) ||
            raw.gardenId !== gardenId ||
            !('body' in raw)
        ) {
            return null;
        }

        const body = parseGardenBlockBatchPurchaseBody(raw.body);
        return body ? { gardenId, body } : null;
    } catch {
        return null;
    }
}

/** Stores the command before it is sent, or clears it (null). */
export function savePendingBlockExpand(
    userId: string,
    gardenId: number,
    command: PendingBlockExpand | null,
    storage: PendingBlockExpandStorage | null = getSessionStorage(),
) {
    if (!storage) {
        return;
    }

    try {
        const key = getPendingBlockExpandKey(userId, gardenId);
        if (command) {
            storage.setItem(
                key,
                JSON.stringify({ gardenId, body: command.body }),
            );
        } else {
            storage.removeItem(key);
        }
    } catch {
        // The mounted bar still holds the command for this session.
    }
}
