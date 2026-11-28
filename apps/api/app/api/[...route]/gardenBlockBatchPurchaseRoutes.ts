import { gardenBlockBatchPurchaseBodySchema } from '@gredice/storage/gardenBlockBatchPurchaseContract';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { authSecurity } from '../../../lib/docs/security';
import {
    isGardenBlockBatchPurchaseReplay,
    purchaseGardenBlockBatch,
} from '../../../lib/garden/gardenBlockBatchPurchaseService';
import { gardenBlockBatchRateLimit } from '../../../lib/garden/gardenBlockBatchRateLimit';
import { gardenBlockPurchaseParamSchema } from '../../../lib/garden/gardenBlockPurchaseSchemas';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const defaults = {
    authValidator,
    isReplay: isGardenBlockBatchPurchaseReplay,
    rateLimit: gardenBlockBatchRateLimit,
    purchase: purchaseGardenBlockBatch,
};

function invalidRequestIssues(
    issues: readonly Readonly<{
        message: string;
        path?: readonly (PropertyKey | Readonly<{ key: PropertyKey }>)[];
    }>[],
) {
    return issues.slice(0, 20).map((issue) => ({
        message: issue.message,
        path: (issue.path ?? [])
            .map((segment) =>
                typeof segment === 'object' ? segment.key : segment,
            )
            .map((segment) =>
                typeof segment === 'symbol' ? '' : String(segment),
            )
            .join('.'),
    }));
}

/**
 * `POST /:gardenId/blocks/batch` (mounted under `/api/gardens`): buy and
 * place many copies of one block at once for Expand. Authentication comes
 * first, then request validation, then the per-account rate limit. An exact
 * retry of a committed batch (same garden, operationId and body) passes a
 * denied limit, because the service only replays its receipt.
 */
export function createGardenBlockBatchPurchaseRoutes(
    dependencies: typeof defaults = defaults,
) {
    return new Hono<{ Variables: AuthVariables }>().post(
        '/:gardenId/blocks/batch',
        describeRoute({
            description:
                'Buy and place copies of one block at many cells in one all-or-nothing transaction with a single sunflower debit (unit price × placements; 0 in sandbox gardens). The server re-checks ownership, price, Expand eligibility, the 10 × 10 / 100-placement caps and every expected stack. Exact retries with the same operationId replay the stored receipt without a second debit.',
            security: authSecurity,
            tags: ['Gardens'],
            responses: {
                200: {
                    description:
                        'Placed (or exact replay, replayed: true); placements in request order.',
                },
                400: {
                    description:
                        'INVALID_REQUEST, EXPANSION_AREA_TOO_LARGE, BLOCK_NOT_EXPANDABLE, BLOCK_NOT_FOR_SALE, BLOCK_NOT_PURCHASABLE_NOW or INSUFFICIENT_SUNFLOWERS.',
                },
                401: { description: 'Authentication required.' },
                404: {
                    description:
                        'GARDEN_NOT_FOUND (not owned or deleted) or BLOCK_NOT_FOUND.',
                },
                409: {
                    description:
                        'PRICE_CHANGED, GARDEN_STATE_CHANGED (with conflicts) or OPERATION_CONFLICT (operationId reused with different input).',
                },
                429: {
                    description:
                        'RATE_LIMITED; retry after the Retry-After seconds. Exact retries of a committed batch are not limited.',
                },
                500: {
                    description:
                        'OPERATION_FAILED; retry the exact same command.',
                },
                503: { description: 'BLOCK_DIRECTORY_UNAVAILABLE.' },
            },
        }),
        dependencies.authValidator(['user', 'admin']),
        zValidator(
            'param',
            gardenBlockPurchaseParamSchema,
            (result, context) => {
                if (!result.success) {
                    return context.json(
                        {
                            code: 'INVALID_REQUEST' as const,
                            error: 'Invalid garden ID',
                            issues: invalidRequestIssues(result.error),
                        },
                        400,
                    );
                }
            },
        ),
        zValidator(
            'json',
            gardenBlockBatchPurchaseBodySchema,
            (result, context) => {
                if (!result.success) {
                    return context.json(
                        {
                            code: 'INVALID_REQUEST' as const,
                            error: 'Invalid garden block batch request',
                            issues: invalidRequestIssues(result.error),
                        },
                        400,
                    );
                }
            },
        ),
        async (context) => {
            context.header('Cache-Control', 'private, no-store');
            const { gardenId } = context.req.valid('param');
            const { accountId } = context.get('authContext');
            const body = context.req.valid('json');
            const rateLimit = await dependencies.rateLimit(accountId);
            if (
                !rateLimit.allowed &&
                !(await dependencies.isReplay({ body, gardenId }))
            ) {
                context.header(
                    'Retry-After',
                    rateLimit.retryAfterSeconds.toString(),
                );
                return context.json(
                    {
                        code: 'RATE_LIMITED' as const,
                        error: 'Too many garden block batch requests',
                        retryAfterSeconds: rateLimit.retryAfterSeconds,
                    },
                    429,
                );
            }

            const result = await dependencies.purchase({
                ...body,
                accountId,
                gardenId,
            });
            if (!result.ok) {
                return context.json(
                    {
                        ...result.details,
                        code: result.code,
                        error: result.error,
                    },
                    result.status,
                );
            }

            const { ok: _ok, ...response } = result;
            return context.json(response, 200);
        },
    );
}

export const gardenBlockBatchPurchaseRoutes =
    createGardenBlockBatchPurchaseRoutes();
