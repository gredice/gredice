import {
    type GardenBlockBatchPurchaseBody,
    type GardenBlockBatchPurchaseConflict,
    type GardenBlockBatchPurchaseResponse,
    gardenBlockBatchPurchaseBodySchema,
    gardenBlockBatchPurchaseErrorSchema,
    gardenBlockBatchPurchaseResponseSchema,
    normalizeGardenBlockRotation,
} from '@gredice/storage/gardenBlockBatchPurchaseContract';
import { clientAuthenticated } from './hono';

export {
    type GardenBlockBatchPurchaseBody,
    type GardenBlockBatchPurchaseConflict,
    type GardenBlockBatchPurchaseResponse,
    gardenBlockBatchPurchaseBodySchema,
};

/** Validates a stored or rebuilt batch command (e.g. from sessionStorage). */
export function parseGardenBlockBatchPurchaseBody(
    value: unknown,
): GardenBlockBatchPurchaseBody | null {
    const parsed = gardenBlockBatchPurchaseBodySchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

export type GardenBlockBatchRequestErrorDetails = Readonly<{
    affordableCount?: number;
    availableAmount?: number;
    conflicts?: readonly GardenBlockBatchPurchaseConflict[];
    maxPlacements?: number;
    maxSide?: number;
    reason?: string;
    requiredAmount?: number;
    retryAfterSeconds?: number;
    unitPrice?: number;
}>;

export class GardenBlockBatchRequestError extends Error {
    override readonly name = 'GardenBlockBatchRequestError';

    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details: GardenBlockBatchRequestErrorDetails = {},
    ) {
        super(message);
    }

    /**
     * True when the server may have applied the batch: the network failed,
     * the session or a timeout interrupted it, or the server failed. Keep the
     * pending command and retry it unchanged (same `operationId`). A 429 is
     * definitive only when the rate limiter sent it (`RATE_LIMITED`).
     */
    get uncertain() {
        return (
            this.status === 0 ||
            this.status === 401 ||
            this.status === 403 ||
            this.status === 408 ||
            (this.status === 429 && this.code !== 'RATE_LIMITED') ||
            this.status >= 500
        );
    }
}

type ResponseHead = Readonly<{ headers: Headers; status: number }>;

function retryAfterSeconds(response: ResponseHead) {
    const header = response.headers.get('Retry-After');
    if (!header || !/^\d+$/.test(header)) {
        return undefined;
    }
    const seconds = Number(header);
    return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
}

function errorFromResponse(response: ResponseHead, result: unknown) {
    const parsed = gardenBlockBatchPurchaseErrorSchema.safeParse(result);
    if (!parsed.success) {
        return new GardenBlockBatchRequestError(
            response.status,
            'OPERATION_FAILED',
            'Garden block batch request failed',
            { retryAfterSeconds: retryAfterSeconds(response) },
        );
    }
    const { code, error, ...details } = parsed.data;
    return new GardenBlockBatchRequestError(response.status, code, error, {
        ...details,
        retryAfterSeconds:
            retryAfterSeconds(response) ?? details.retryAfterSeconds,
    });
}

/**
 * Buy and place copies of one block at many cells in one atomic request
 * (`POST /api/gardens/:gardenId/blocks/batch`). Resolves with the receipt,
 * whose placements are in request order. Throws
 * `GardenBlockBatchRequestError`; check `uncertain` before discarding the
 * pending command.
 */
export async function placeGardenBlockBatch(
    input: GardenBlockBatchPurchaseBody & { gardenId: number },
): Promise<GardenBlockBatchPurchaseResponse> {
    const { gardenId, ...json } = input;
    const response = await clientAuthenticated()
        .api.gardens[':gardenId'].blocks.batch.$post({
            param: { gardenId: gardenId.toString() },
            json,
        })
        .catch(() => {
            throw new GardenBlockBatchRequestError(
                0,
                'NETWORK_ERROR',
                'Garden block batch response did not arrive',
            );
        });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        throw errorFromResponse(response, result);
    }

    const parsed = gardenBlockBatchPurchaseResponseSchema.safeParse(result);
    if (
        !parsed.success ||
        parsed.data.operationId !== json.operationId ||
        parsed.data.blockName !== json.blockName ||
        parsed.data.rotation !== normalizeGardenBlockRotation(json.rotation) ||
        parsed.data.unitPrice !== json.expectedUnitPrice ||
        parsed.data.chargedSunflowers !==
            json.expectedUnitPrice * json.placements.length ||
        parsed.data.placements.length !== json.placements.length ||
        new Set(parsed.data.placements.map((placement) => placement.id))
            .size !== json.placements.length ||
        parsed.data.placements.some((placement, index) => {
            const requested = json.placements[index]?.position;
            return (
                !requested ||
                placement.position.x !== requested.x ||
                placement.position.y !== requested.y
            );
        })
    ) {
        throw new GardenBlockBatchRequestError(
            500,
            'INVALID_RECEIPT',
            'Garden block batch receipt could not be verified',
        );
    }
    return parsed.data;
}
