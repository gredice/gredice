import {
    DeliveryNativeAuthError,
    exchangeDeliveryNativeAuthorizationCode,
    revokeDeliveryNativeRefreshToken,
    rotateDeliveryNativeRefreshToken,
} from '@gredice/storage';
import { Hono, type MiddlewareHandler } from 'hono';
import { describeRoute, resolver, validator as zValidator } from 'hono-openapi';
import { createDeliveryMobileAccessJwt } from '../../../lib/auth/auth';
import {
    deliveryNativeAuthClientAddress,
    deliveryNativeAuthRateLimitAllows,
    deliveryNativeAuthRetryAfterSeconds,
} from '../../../lib/auth/deliveryNativeAuthRateLimit';
import { deliveryAndroidAutoEnabled } from '../../../lib/delivery/deliveryAndroidAutoFlag';
import {
    deliveryNativeAccessTokenLifetimeSeconds,
    deliveryNativeAuthErrorResponseSchema,
    deliveryNativeRefreshRequestSchema,
    deliveryNativeRevokeRequestSchema,
    deliveryNativeTokenRequestSchema,
    deliveryNativeTokenResponseSchema,
} from '../../../lib/delivery/deliveryMobileAuthContract';
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

const authNoStoreHeaders = {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
};

type DeliveryNativeSession = {
    userId: string;
    accountId: string;
    familyId: string;
    expiresAt: Date;
    refreshToken: string;
};

export type DeliveryNativeAuthRouteDeps = {
    exchangeCode: (input: {
        code: string;
        codeVerifier: string;
        clientId: string;
        redirectUri: string;
    }) => Promise<DeliveryNativeSession>;
    rotateRefresh: (input: {
        refreshToken: string;
        clientId: string;
    }) => Promise<DeliveryNativeSession>;
    revokeRefresh: (input: {
        refreshToken: string;
        clientId: string;
    }) => Promise<boolean>;
    issueAccessToken: (input: {
        userId: string;
        accountId: string;
    }) => Promise<string>;
    rateLimitAllows: (input: {
        operation: 'exchange' | 'refresh';
        headers: Headers;
    }) => Promise<boolean>;
    retryAfterSeconds: number;
    onUnexpectedError: () => void;
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
    enabled: () => boolean;
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
    nativeAuth?: DeliveryNativeAuthRouteDeps;
};

const defaultNativeAuthDeps: DeliveryNativeAuthRouteDeps = {
    exchangeCode: exchangeDeliveryNativeAuthorizationCode,
    rotateRefresh: rotateDeliveryNativeRefreshToken,
    revokeRefresh: revokeDeliveryNativeRefreshToken,
    issueAccessToken: ({ userId, accountId }) =>
        createDeliveryMobileAccessJwt({
            userId,
            accountId,
            scope: 'delivery:route:read',
            expiresInMs: deliveryNativeAccessTokenLifetimeSeconds * 1_000,
        }),
    rateLimitAllows: ({ operation, headers }) =>
        deliveryNativeAuthRateLimitAllows({
            operation,
            clientAddress: deliveryNativeAuthClientAddress(headers),
        }),
    retryAfterSeconds: deliveryNativeAuthRetryAfterSeconds,
    onUnexpectedError() {
        console.error('Delivery native authentication failed', {
            errorCode: 'AUTH_TEMPORARILY_UNAVAILABLE',
        });
    },
};

const defaultDeps: DeliveryMobileRouteDeps = {
    enabled: deliveryAndroidAutoEnabled,
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

function nativeAuthStatus(code: DeliveryNativeAuthError['code']) {
    if (code === 'DELIVERY_ROLE_REQUIRED' || code === 'ACCOUNT_NOT_ELIGIBLE') {
        return 403 as const;
    }
    if (code.startsWith('REFRESH_')) return 401 as const;
    return 400 as const;
}

function nativeAuthMessage(code: DeliveryNativeAuthError['code']) {
    switch (code) {
        case 'AUTH_CODE_EXPIRED':
            return 'Kod za prijavu je istekao.';
        case 'AUTH_CODE_REPLAYED':
            return 'Kod za prijavu već je iskorišten.';
        case 'PKCE_MISMATCH':
            return 'Potvrda prijave nije valjana.';
        case 'DELIVERY_ROLE_REQUIRED':
            return 'Potrebna je uloga dostavljača.';
        case 'ACCOUNT_NOT_ELIGIBLE':
            return 'Odabrani račun više nije dostupan.';
        case 'REFRESH_REVOKED':
            return 'Sesija je opozvana.';
        case 'REFRESH_EXPIRED':
            return 'Sesija je istekla.';
        case 'REFRESH_REPLAYED':
            return 'Sesija je opozvana zbog ponovne uporabe.';
        case 'REFRESH_INVALID':
            return 'Sesija nije valjana.';
        case 'AUTH_CODE_INVALID':
            return 'Kod za prijavu nije valjan.';
    }
}

async function nativeTokenResponse(
    nativeAuth: DeliveryNativeAuthRouteDeps,
    session: DeliveryNativeSession,
) {
    return deliveryNativeTokenResponseSchema.parse({
        access_token: await nativeAuth.issueAccessToken(session),
        token_type: 'Bearer',
        expires_in: deliveryNativeAccessTokenLifetimeSeconds,
        refresh_token: session.refreshToken,
        refresh_expires_at: session.expiresAt.toISOString(),
        scope: 'delivery:route:read',
    });
}

const nativeAuthResponses = {
    200: {
        description:
            'A dedicated access token and rotated native refresh credential',
        content: {
            'application/json': {
                schema: resolver(deliveryNativeTokenResponseSchema),
            },
        },
    },
    400: {
        description: 'The authorization grant or PKCE verifier is invalid',
        content: {
            'application/json': {
                schema: resolver(deliveryNativeAuthErrorResponseSchema),
            },
        },
    },
    401: {
        description:
            'The native refresh session is invalid, expired, or revoked',
        content: {
            'application/json': {
                schema: resolver(deliveryNativeAuthErrorResponseSchema),
            },
        },
    },
    403: {
        description: 'The user role or selected account is no longer eligible',
        content: {
            'application/json': {
                schema: resolver(deliveryNativeAuthErrorResponseSchema),
            },
        },
    },
    429: {
        description: 'Too many native authentication attempts',
        content: {
            'application/json': {
                schema: resolver(deliveryNativeAuthErrorResponseSchema),
            },
        },
    },
    503: {
        description: 'Native authentication is temporarily unavailable',
        content: {
            'application/json': {
                schema: resolver(deliveryNativeAuthErrorResponseSchema),
            },
        },
    },
};

export function createDeliveryMobileRoutes(
    deps: DeliveryMobileRouteDeps = defaultDeps,
) {
    const nativeAuth = deps.nativeAuth ?? defaultNativeAuthDeps;
    return new Hono<{ Variables: DeliveryMobileAuthVariables }>()
        .use('/auth/*', async (context, next) => {
            for (const [name, value] of Object.entries(authNoStoreHeaders)) {
                context.header(name, value);
            }
            await next();
        })
        .use('*', async (context, next) => {
            if (
                deps.enabled() ||
                (context.req.method === 'POST' &&
                    context.req.path.endsWith('/auth/revoke'))
            ) {
                await next();
                return;
            }
            return context.json(
                {
                    error: 'Android Auto trenutačno nije dostupan.',
                    code: 'ANDROID_AUTO_DISABLED' as const,
                },
                503,
                context.req.path.includes('/auth/')
                    ? authNoStoreHeaders
                    : privateNoStoreHeaders,
            );
        })
        .post(
            '/auth/token',
            describeRoute({
                description:
                    'Atomically exchange a single-use browser authorization code using S256 PKCE.',
                tags: ['Delivery Mobile'],
                responses: nativeAuthResponses,
            }),
            zValidator(
                'json',
                deliveryNativeTokenRequestSchema,
                (result, context) => {
                    if (!result.success) {
                        return context.json(
                            {
                                error: 'Zahtjev za prijavu nije valjan.',
                                code: 'AUTH_CODE_INVALID' as const,
                            },
                            400,
                        );
                    }
                },
            ),
            async (context) => {
                const request = context.req.valid('json');
                if (
                    !(await nativeAuth.rateLimitAllows({
                        operation: 'exchange',
                        headers: context.req.raw.headers,
                    }))
                ) {
                    context.header(
                        'Retry-After',
                        nativeAuth.retryAfterSeconds.toString(),
                    );
                    return context.json(
                        {
                            error: 'Previše pokušaja prijave.',
                            code: 'RATE_LIMITED' as const,
                        },
                        429,
                    );
                }
                try {
                    const session = await nativeAuth.exchangeCode({
                        code: request.code,
                        codeVerifier: request.code_verifier,
                        clientId: request.client_id,
                        redirectUri: request.redirect_uri,
                    });
                    return context.json(
                        await nativeTokenResponse(nativeAuth, session),
                    );
                } catch (error) {
                    if (error instanceof DeliveryNativeAuthError) {
                        return context.json(
                            {
                                error: nativeAuthMessage(error.code),
                                code: error.code,
                            },
                            nativeAuthStatus(error.code),
                        );
                    }
                    nativeAuth.onUnexpectedError();
                    return context.json(
                        {
                            error: 'Prijava trenutačno nije dostupna.',
                            code: 'AUTH_TEMPORARILY_UNAVAILABLE' as const,
                        },
                        503,
                    );
                }
            },
        )
        .post(
            '/auth/refresh',
            describeRoute({
                description:
                    'Rotate a native refresh credential. Reuse revokes the full session family.',
                tags: ['Delivery Mobile'],
                responses: nativeAuthResponses,
            }),
            zValidator(
                'json',
                deliveryNativeRefreshRequestSchema,
                (result, context) => {
                    if (!result.success) {
                        return context.json(
                            {
                                error: 'Sesija nije valjana.',
                                code: 'REFRESH_INVALID' as const,
                            },
                            401,
                        );
                    }
                },
            ),
            async (context) => {
                const request = context.req.valid('json');
                if (
                    !(await nativeAuth.rateLimitAllows({
                        operation: 'refresh',
                        headers: context.req.raw.headers,
                    }))
                ) {
                    context.header(
                        'Retry-After',
                        nativeAuth.retryAfterSeconds.toString(),
                    );
                    return context.json(
                        {
                            error: 'Previše pokušaja obnove sesije.',
                            code: 'RATE_LIMITED' as const,
                        },
                        429,
                    );
                }
                try {
                    const session = await nativeAuth.rotateRefresh({
                        refreshToken: request.refresh_token,
                        clientId: request.client_id,
                    });
                    return context.json(
                        await nativeTokenResponse(nativeAuth, session),
                    );
                } catch (error) {
                    if (error instanceof DeliveryNativeAuthError) {
                        return context.json(
                            {
                                error: nativeAuthMessage(error.code),
                                code: error.code,
                            },
                            nativeAuthStatus(error.code),
                        );
                    }
                    nativeAuth.onUnexpectedError();
                    return context.json(
                        {
                            error: 'Obnova sesije trenutačno nije dostupna.',
                            code: 'AUTH_TEMPORARILY_UNAVAILABLE' as const,
                        },
                        503,
                    );
                }
            },
        )
        .post(
            '/auth/revoke',
            describeRoute({
                description:
                    'Revoke the complete native session family. The operation is idempotent.',
                tags: ['Delivery Mobile'],
                responses: {
                    204: { description: 'The native session is revoked' },
                    400: nativeAuthResponses[400],
                    503: nativeAuthResponses[503],
                },
            }),
            zValidator(
                'json',
                deliveryNativeRevokeRequestSchema,
                (result, context) => {
                    if (!result.success) {
                        return context.json(
                            {
                                error: 'Zahtjev za odjavu nije valjan.',
                                code: 'REFRESH_INVALID' as const,
                            },
                            400,
                        );
                    }
                },
            ),
            async (context) => {
                const request = context.req.valid('json');
                try {
                    await nativeAuth.revokeRefresh({
                        refreshToken: request.refresh_token,
                        clientId: request.client_id,
                    });
                    return context.body(null, 204);
                } catch {
                    nativeAuth.onUnexpectedError();
                    return context.json(
                        {
                            error: 'Odjava trenutačno nije dostupna.',
                            code: 'AUTH_TEMPORARILY_UNAVAILABLE' as const,
                        },
                        503,
                    );
                }
            },
        )
        .get(
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
                                schema: resolver(
                                    deliveryMobileErrorResponseSchema,
                                ),
                            },
                        },
                    },
                    403: {
                        description:
                            'The native session lacks the required scope, role, or account binding',
                        content: {
                            'application/json': {
                                schema: resolver(
                                    deliveryMobileErrorResponseSchema,
                                ),
                            },
                        },
                    },
                    503: {
                        description:
                            'The active-route projection is temporarily unavailable',
                        content: {
                            'application/json': {
                                schema: resolver(
                                    deliveryMobileErrorResponseSchema,
                                ),
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
                    const response =
                        deliveryMobileActiveRouteResponseSchema.parse(
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
