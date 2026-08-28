import { Hono, type MiddlewareHandler } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import {
    type DeliveryMobileProjectionResult,
    deliveryMobileActiveRouteEtag,
    readDeliveryMobileActiveRoute,
    requestMatchesEtag,
} from '../../../lib/delivery/mobileActiveRoute';
import {
    deliveryMobileActiveRouteResponseSchema,
    deliveryMobileErrorResponseSchema,
} from '../../../lib/delivery/mobileActiveRouteContract';
import {
    type DeliveryMobileAuthContext,
    type DeliveryMobileAuthVariables,
    deliveryMobileAuthValidator,
} from '../../../lib/hono/deliveryMobileAuthValidator';

const privateNoStoreHeaders = {
    'Cache-Control': 'private, no-store',
};

type DeliveryMobileReadEvent = {
    resultKind: 'active' | 'no-route' | 'error';
    routeRevision: number | null;
    stopCount: number;
    omittedInvalidNodeCount: number;
    durationMs: number;
    errorCode?: 'ROUTE_TEMPORARILY_UNAVAILABLE';
};

export type DeliveryMobileRouteDeps = {
    authValidator: MiddlewareHandler<{
        Variables: DeliveryMobileAuthVariables;
    }>;
    now: () => Date;
    readActiveRoute: (input: {
        userId: string;
        generatedAt: Date;
    }) => Promise<DeliveryMobileProjectionResult>;
    recordRead: (event: DeliveryMobileReadEvent) => void;
    onUnexpectedError: () => void;
};

const defaultDeps: DeliveryMobileRouteDeps = {
    authValidator: deliveryMobileAuthValidator,
    now: () => new Date(),
    readActiveRoute: readDeliveryMobileActiveRoute,
    recordRead(event) {
        if (event.omittedInvalidNodeCount > 0) {
            console.warn('Delivery mobile route omitted invalid nodes', event);
        }
    },
    onUnexpectedError() {
        console.error('Delivery mobile route projection failed', {
            errorCode: 'ROUTE_TEMPORARILY_UNAVAILABLE',
        });
    },
};

function durationMs(startedAt: number) {
    return Math.max(0, Date.now() - startedAt);
}

export function createDeliveryMobileRoutes(
    deps: DeliveryMobileRouteDeps = defaultDeps,
) {
    return new Hono<{ Variables: DeliveryMobileAuthVariables }>().get(
        '/active-route',
        describeRoute({
            description:
                'Get the authenticated driver active-route projection for the Android Auto companion. Requires a delivery-android audience token with delivery:route:read scope and never mutates delivery state.',
            security: [{ bearerAuth: [] }],
            tags: ['Delivery Mobile'],
            responses: {
                200: {
                    description:
                        'Current and bounded next navigable stops, or a null route when no run is active',
                    content: {
                        'application/json': {
                            schema: resolver(
                                deliveryMobileActiveRouteResponseSchema,
                            ),
                        },
                    },
                },
                304: {
                    description:
                        'The subject-bound visible route projection has not changed',
                },
                401: {
                    description:
                        'A valid delivery-android bearer session is required',
                    content: {
                        'application/json': {
                            schema: resolver(deliveryMobileErrorResponseSchema),
                        },
                    },
                },
                403: {
                    description:
                        'The native session lacks the required scope, role, or account binding',
                    content: {
                        'application/json': {
                            schema: resolver(deliveryMobileErrorResponseSchema),
                        },
                    },
                },
                503: {
                    description:
                        'The active-route projection is temporarily unavailable',
                    content: {
                        'application/json': {
                            schema: resolver(deliveryMobileErrorResponseSchema),
                        },
                    },
                },
            },
        }),
        deps.authValidator,
        async (context) => {
            const startedAt = Date.now();
            const auth = context.get('deliveryMobileAuthContext');
            try {
                const result = await deps.readActiveRoute({
                    userId: auth.userId,
                    generatedAt: deps.now(),
                });
                const response = deliveryMobileActiveRouteResponseSchema.parse(
                    result.response,
                );
                const etag = deliveryMobileActiveRouteEtag({
                    response,
                    subject: auth,
                });
                const headers = {
                    ...privateNoStoreHeaders,
                    ETag: etag,
                };
                const routeRevision = response.route?.revision ?? null;
                const stopCount = response.route?.stops.length ?? 0;
                const resultKind = response.route ? 'active' : 'no-route';
                deps.recordRead({
                    resultKind,
                    routeRevision,
                    stopCount,
                    omittedInvalidNodeCount: result.omittedInvalidNodeCount,
                    durationMs: durationMs(startedAt),
                });

                if (
                    requestMatchesEtag(
                        context.req.header('If-None-Match'),
                        etag,
                    )
                ) {
                    return context.body(null, 304, headers);
                }
                return context.json(response, 200, headers);
            } catch {
                deps.onUnexpectedError();
                deps.recordRead({
                    resultKind: 'error',
                    routeRevision: null,
                    stopCount: 0,
                    omittedInvalidNodeCount: 0,
                    durationMs: durationMs(startedAt),
                    errorCode: 'ROUTE_TEMPORARILY_UNAVAILABLE',
                });
                return context.json(
                    {
                        error: 'Ruta trenutačno nije dostupna.',
                        code: 'ROUTE_TEMPORARILY_UNAVAILABLE',
                    },
                    503,
                    privateNoStoreHeaders,
                );
            }
        },
    );
}

export function createTestDeliveryMobileAuthMiddleware(
    auth: DeliveryMobileAuthContext = {
        userId: 'driver-user',
        accountId: 'driver-account',
        role: 'driver',
    },
): MiddlewareHandler<{ Variables: DeliveryMobileAuthVariables }> {
    return async (context, next) => {
        context.set('deliveryMobileAuthContext', auth);
        await next();
    };
}

export default createDeliveryMobileRoutes();
