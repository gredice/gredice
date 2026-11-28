/**
 * Sunflower history reasons written by garden block purchases and refunds:
 *
 * - `gardenBlock:<gardenId>:purchase:<operationId>`: one placed block;
 * - `gardenBlock:<gardenId>:expand:<operationId>`: one debit for every copy
 *   an Expand batch placed;
 * - `gardenBlock:<gardenId>:recycle:<blockId>`: the refund for a removed
 *   block.
 *
 * The second segment is a garden id, not a block name.
 */
export type GardenBlockReasonKind = 'purchase' | 'expand' | 'recycle';

const gardenBlockReasonPrefix = 'gardenBlock';

export const gardenBlockReasonLabels: Record<GardenBlockReasonKind, string> = {
    purchase: 'Postavljanje bloka',
    expand: 'Proširivanje bloka',
    recycle: 'Recikliranje bloka',
};

/** The kind of a `gardenBlock:` reason, or null for any other reason. */
export function getGardenBlockReasonKind(
    reason: string,
): GardenBlockReasonKind | null {
    const [prefix, , kind] = reason.split(':');
    if (prefix !== gardenBlockReasonPrefix) {
        return null;
    }

    switch (kind) {
        case 'purchase':
        case 'expand':
        case 'recycle':
            return kind;
        default:
            return null;
    }
}

/**
 * The part of a reason that history events are grouped by (per day and
 * amount): `refund:<kind>` for refunds, `gardenBlock:<kind>` for garden
 * blocks, so a purchase, an Expand debit and a refund never merge, and the
 * first segment for everything else.
 */
export function getSunflowerHistoryReasonGroup(reason: unknown) {
    const parts = typeof reason === 'string' ? reason.split(':') : [];
    if (parts[0] === 'refund') {
        return parts.slice(0, 2).join(':');
    }

    const gardenBlockKind =
        typeof reason === 'string' ? getGardenBlockReasonKind(reason) : null;
    if (gardenBlockKind) {
        return `${gardenBlockReasonPrefix}:${gardenBlockKind}`;
    }

    return parts[0] ?? 'unknown';
}
