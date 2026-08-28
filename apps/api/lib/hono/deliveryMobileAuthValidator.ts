import { getUser } from '@gredice/storage';
import type { MiddlewareHandler } from 'hono';
import 'server-only';
import { verifyJwt } from '../auth/auth';
import {
    deliveryMobileAudience,
    deliveryMobileRouteScope,
} from '../delivery/mobileActiveRouteContract';

export type DeliveryMobileAuthContext = {
    userId: string;
    accountId: string;
    role: 'driver' | 'admin';
};

export type DeliveryMobileAuthVariables = {
    deliveryMobileAuthContext: DeliveryMobileAuthContext;
};

type DeliveryMobileAuthUser = {
    id: string;
    role: string;
    accountIds: string[];
};

export type DeliveryMobileAuthDeps = {
    verifyAccessToken: (token: string) => Promise<{
        payload?: Record<string, unknown>;
        error?: unknown;
    }>;
    getUser: (userId: string) => Promise<DeliveryMobileAuthUser | null>;
};

const defaultDeps: DeliveryMobileAuthDeps = {
    async verifyAccessToken(token) {
        const { result, error } = await verifyJwt(token, {
            audience: deliveryMobileAudience,
        });
        return {
            payload: result?.payload ? { ...result.payload } : undefined,
            error,
        };
    },
    async getUser(userId) {
        const user = await getUser(userId);
        return user
            ? {
                  id: user.id,
                  role: user.role,
                  accountIds: user.accounts.map((account) => account.accountId),
              }
            : null;
    },
};

type DeliveryMobileAuthorizationResult =
    | { authorized: true; context: DeliveryMobileAuthContext }
    | {
          authorized: false;
          status: 401 | 403;
          code: 'SESSION_REQUIRED' | 'DELIVERY_ROLE_REQUIRED';
      };

function bearerToken(authorization: string | undefined) {
    if (!authorization?.toLowerCase().startsWith('bearer ')) return null;
    const token = authorization.slice(7).trim();
    return token.length > 0 ? token : null;
}

function hasRouteReadScope(value: unknown) {
    if (typeof value === 'string') {
        return value.split(/\s+/).includes(deliveryMobileRouteScope);
    }
    return Array.isArray(value) && value.includes(deliveryMobileRouteScope);
}

export async function authorizeDeliveryMobileBearer({
    authorization,
    deps = defaultDeps,
}: {
    authorization: string | undefined;
    deps?: DeliveryMobileAuthDeps;
}): Promise<DeliveryMobileAuthorizationResult> {
    const token = bearerToken(authorization);
    if (!token) {
        return {
            authorized: false,
            status: 401,
            code: 'SESSION_REQUIRED',
        };
    }

    const { payload, error } = await deps.verifyAccessToken(token);
    const userId = payload?.sub;
    if (
        error ||
        !payload ||
        typeof userId !== 'string' ||
        userId.length === 0
    ) {
        return {
            authorized: false,
            status: 401,
            code: 'SESSION_REQUIRED',
        };
    }

    const accountId = payload.account_id;
    const user = await deps.getUser(userId);
    if (
        !user ||
        (user.role !== 'driver' && user.role !== 'admin') ||
        typeof accountId !== 'string' ||
        !user.accountIds.includes(accountId) ||
        !hasRouteReadScope(payload.scope)
    ) {
        return {
            authorized: false,
            status: 403,
            code: 'DELIVERY_ROLE_REQUIRED',
        };
    }

    return {
        authorized: true,
        context: {
            userId: user.id,
            accountId,
            role: user.role,
        },
    };
}

export function createDeliveryMobileAuthValidator(
    deps: DeliveryMobileAuthDeps = defaultDeps,
): MiddlewareHandler<{ Variables: DeliveryMobileAuthVariables }> {
    return async (context, next) => {
        const result = await authorizeDeliveryMobileBearer({
            authorization: context.req.header('Authorization'),
            deps,
        });
        if (!result.authorized) {
            const error =
                result.code === 'SESSION_REQUIRED'
                    ? 'Prijava je potrebna.'
                    : 'Potrebna je uloga dostavljača.';
            return context.json({ error, code: result.code }, result.status, {
                'Cache-Control': 'private, no-store',
            });
        }

        context.set('deliveryMobileAuthContext', result.context);
        await next();
    };
}

export const deliveryMobileAuthValidator = createDeliveryMobileAuthValidator();
