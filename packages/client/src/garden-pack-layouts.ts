import {
    gardenPackGroupPlacementBodySchema,
    gardenPackGroupPlacementPublicResponseSchema,
    gardenPackLayoutsResponseSchema,
} from '@gredice/storage/gardenPackGroupPlacementContract';
import type { InferRequestType, InferResponseType } from 'hono';
import { clientAuthenticated } from './hono';

export { gardenPackGroupPlacementBodySchema };
export function parseGardenPackGroupPlacementBody(
    value: unknown,
): GardenPackGroupPlacementBody | null {
    const parsed = gardenPackGroupPlacementBodySchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

const layoutEndpoint = () =>
    clientAuthenticated().api.accounts.current['garden-packs'][':purchaseId']
        .layouts;
type Endpoint = ReturnType<typeof layoutEndpoint>;
export type GardenPackLayoutsResponse = InferResponseType<
    Endpoint['$get'],
    200
>;
export type GardenPackGroupPlacementBody = InferRequestType<
    Endpoint[':layoutId']['place']['$post']
>['json'];
export type GardenPackGroupPlacementResponse = InferResponseType<
    Endpoint[':layoutId']['place']['$post'],
    200
>;
export class GardenPackGroupPlacementRequestError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message);
    }
    get uncertain() {
        return (
            this.status === 0 ||
            this.status === 401 ||
            this.status === 403 ||
            this.status === 408 ||
            this.status === 429 ||
            this.status >= 500 ||
            this.code === 'EXPECTED_ACCOUNT_MISMATCH'
        );
    }
}
export async function getGardenPackLayouts(
    purchaseId: string,
    options: { signal?: AbortSignal } = {},
) {
    const response = await layoutEndpoint().$get(
        { param: { purchaseId } },
        { init: { signal: options.signal } },
    );
    const result = await response.json().catch(() => null);
    const parsed = gardenPackLayoutsResponseSchema.safeParse(result);
    if (
        !response.ok ||
        !parsed.success ||
        parsed.data.purchaseId !== purchaseId
    )
        throw new GardenPackGroupPlacementRequestError(
            response.status || 500,
            'LAYOUT_READ_FAILED',
            'Rasporede trenutačno nije moguće učitati.',
        );
    return parsed.data;
}
export async function placeGardenPackLayout(
    input: GardenPackGroupPlacementBody & {
        purchaseId: string;
        layoutId: string;
    },
) {
    const { purchaseId, layoutId, ...json } = input;
    const response = await layoutEndpoint()
        [':layoutId'].place.$post({ param: { purchaseId, layoutId }, json })
        .catch(() => {
            throw new GardenPackGroupPlacementRequestError(
                0,
                'NETWORK_ERROR',
                'Potvrda rasporeda nije stigla. Pokušaj ponovno istim zahtjevom.',
            );
        });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
        const code =
            result &&
            typeof result === 'object' &&
            'code' in result &&
            typeof result.code === 'string'
                ? result.code
                : 'GROUP_PLACEMENT_FAILED';
        const message =
            result &&
            typeof result === 'object' &&
            'error' in result &&
            typeof result.error === 'string'
                ? result.error
                : 'Postavljanje rasporeda nije uspjelo.';
        throw new GardenPackGroupPlacementRequestError(
            response.status,
            code,
            message,
        );
    }
    const parsed =
        gardenPackGroupPlacementPublicResponseSchema.safeParse(result);
    if (
        !parsed.success ||
        parsed.data.operationId !== json.operationId ||
        parsed.data.purchaseId !== purchaseId ||
        parsed.data.gardenId !== json.gardenId ||
        parsed.data.layoutId !== layoutId ||
        parsed.data.layoutVersionId !== json.layoutVersionId ||
        parsed.data.placements.length !== json.units.length ||
        new Set(parsed.data.placements.map((p) => p.slotId)).size !==
            json.units.length ||
        new Set(parsed.data.placements.map((p) => p.blockId)).size !==
            json.units.length ||
        parsed.data.placements.some(
            (p) =>
                !json.units.some(
                    (u) =>
                        u.slotId === p.slotId &&
                        u.lineId === p.lineId &&
                        u.unitOrdinal === p.unitOrdinal,
                ),
        )
    )
        throw new GardenPackGroupPlacementRequestError(
            500,
            'INVALID_RECEIPT',
            'Potvrdu rasporeda nije moguće provjeriti. Pokušaj ponovno istim zahtjevom.',
        );
    return parsed.data;
}
