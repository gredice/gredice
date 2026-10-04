import {
    type GardenPackGroupPlacementBody,
    gardenPackGroupPlacementBodySchema,
} from '@gredice/client';

export type PendingPackLayout = {
    purchaseId: string;
    layoutId: string;
    body: GardenPackGroupPlacementBody;
};
const key = (userId: string, accountId: string, gardenId: number) =>
    `gredice:pending-pack-layout:${JSON.stringify([userId, accountId, gardenId])}`;
export function readPendingPackLayout(
    userId: string,
    accountId: string,
    gardenId: number,
): PendingPackLayout | null {
    try {
        const raw: unknown = JSON.parse(
            sessionStorage.getItem(key(userId, accountId, gardenId)) ?? 'null',
        );
        if (
            !raw ||
            typeof raw !== 'object' ||
            !('purchaseId' in raw) ||
            typeof raw.purchaseId !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
                raw.purchaseId,
            ) ||
            !('layoutId' in raw) ||
            typeof raw.layoutId !== 'string' ||
            raw.layoutId.length < 1 ||
            raw.layoutId.length > 100 ||
            !('body' in raw)
        )
            return null;
        const parsed = gardenPackGroupPlacementBodySchema.safeParse(raw.body);
        const body = parsed.success ? parsed.data : null;
        return body &&
            body.expectedAccountId === accountId &&
            body.gardenId === gardenId
            ? { purchaseId: raw.purchaseId, layoutId: raw.layoutId, body }
            : null;
    } catch {
        return null;
    }
}
export function savePendingPackLayout(
    userId: string,
    accountId: string,
    gardenId: number,
    command: PendingPackLayout | null,
) {
    try {
        if (command)
            sessionStorage.setItem(
                key(userId, accountId, gardenId),
                JSON.stringify(command),
            );
        else sessionStorage.removeItem(key(userId, accountId, gardenId));
    } catch {
        /* The mounted session still retains the exact reviewed command. */
    }
}
