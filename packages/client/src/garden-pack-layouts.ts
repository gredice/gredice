import {
    gardenPackGroupPlacementBodySchema,
    gardenPackGroupPlacementResponseSchema,
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
            this.status === 408 || this.status === 429 ||
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
    const result = await response.json();
    if (!response.ok || !('layouts' in result))
        throw new GardenPackGroupPlacementRequestError(
            response.status,
            'code' in result ? result.code : 'LAYOUT_READ_FAILED',
            'Rasporede trenutačno nije moguće učitati.',
        );
    return result;
}
export async function placeGardenPackLayout(
    input: GardenPackGroupPlacementBody & {
        purchaseId: string;
        layoutId: string;
    },
) {
    const { purchaseId, layoutId, ...json } = input;
    const response = await layoutEndpoint()[':layoutId'].place.$post({
        param: { purchaseId, layoutId },
        json,
    });
    const result = await response.json();
    if (!response.ok || !('placements' in result))
        throw new GardenPackGroupPlacementRequestError(
            response.status,
            'code' in result ? result.code : 'GROUP_PLACEMENT_FAILED',
            'error' in result
                ? result.error
                : 'Postavljanje rasporeda nije uspjelo.',
        );
    const { replayed, ...receipt } = result;
    const parsed = gardenPackGroupPlacementResponseSchema.safeParse(receipt);
    if (
        !parsed.success ||
        typeof replayed !== 'boolean' ||
        parsed.data.operationId !== json.operationId ||
        parsed.data.purchaseId !== purchaseId ||
        parsed.data.gardenId !== json.gardenId ||
        parsed.data.layoutId !== layoutId ||
        parsed.data.layoutVersionId !== json.layoutVersionId ||
        parsed.data.placements.length !== json.units.length ||
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
    return { ...parsed.data, replayed };
}
