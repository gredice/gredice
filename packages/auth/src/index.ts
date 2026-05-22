import 'server-only';

import { type JWTPayload, jwtVerify, SignJWT } from 'jose';
import { cookies, headers } from 'next/headers';

export type UserBase = {
    id: string;
    accountIds: string[];
};

export type RbacUserBase = UserBase & {
    role: string;
};

export type AuthConfig<TUser extends UserBase> = {
    security?: {
        expiry?: number;
    };
    jwt?: {
        namespace?: string;
        issuer?: string;
        audience?: string;
        jwtSecretFactory: () => Promise<Uint8Array> | Uint8Array;
        expiry?: string | number | Date;
    };
    cookie?: {
        name?: string;
        expiry?: number;
    };
    getUser:
        | ((userId: string) => Promise<TUser | null | undefined>)
        | ((userId: string) => TUser | null | undefined);
};

export type AuthConfigInitialized<TUser extends UserBase> = {
    security: {
        expiry: number;
    };
    jwt: {
        namespace: string;
        issuer: string;
        audience: string;
        jwtSecretFactory: () => Promise<Uint8Array> | Uint8Array;
        expiry: string | number | Date;
    };
    cookie: {
        name: string;
        expiry: number;
    };
    getUser: AuthConfig<TUser>['getUser'];
};

export type AuthContext<TUser extends UserBase> = {
    userId: string;
    user: TUser;
    accountId: string;
};

export type WithAuthContext<TUser extends UserBase> = AuthContext<TUser>;

class UnauthorizedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnauthorizedError';
    }
}

function issuer({ issuer, namespace }: AuthConfigInitialized<UserBase>['jwt']) {
    return `urn:${namespace}:issuer:${issuer}`;
}

function audience({
    audience: jwtAudience,
    namespace,
}: AuthConfigInitialized<UserBase>['jwt']) {
    return `urn:${namespace}:audience:${jwtAudience}`;
}

export async function verifyToken<TUser extends UserBase>(
    authConfig: AuthConfigInitialized<TUser>['jwt'],
    token: string,
): Promise<{
    result?: {
        payload: JWTPayload;
    };
    error?: unknown;
}> {
    try {
        const result = await jwtVerify(
            token,
            await authConfig.jwtSecretFactory(),
            {
                audience: audience(authConfig),
                issuer: issuer(authConfig),
            },
        );

        return {
            result: {
                payload: result.payload,
            },
        };
    } catch (error) {
        return { error };
    }
}

export async function ensureAuthUserId<TUser extends UserBase>(
    authConfig: AuthConfigInitialized<TUser>,
) {
    let token = (await cookies()).get(authConfig.cookie.name)?.value;

    if (!token) {
        const authorization = (await headers()).get('Authorization');
        if (authorization?.toLowerCase().startsWith('bearer ')) {
            token = authorization.substring(7);
        }
    }

    if (!token) {
        throw new UnauthorizedError('Unauthorized: No token provided');
    }

    const { error, result } = await verifyToken(authConfig.jwt, token);
    if (error) {
        console.error('JWT verification error:', error);
        throw new UnauthorizedError('Unauthorized: Invalid token');
    }

    const userId = result?.payload.sub;
    if (!userId || userId.length === 0) {
        throw new UnauthorizedError('Unauthorized: Invalid user ID');
    }

    return { userId };
}

export async function auth<TUser extends UserBase>(
    config: AuthConfigInitialized<TUser>,
): Promise<AuthContext<TUser>> {
    const { userId } = await ensureAuthUserId(config);
    const user = await config.getUser(userId);
    if (!user) {
        throw new Error('User not found');
    }

    const accountId = user.accountIds[0];
    if (!accountId) {
        throw new Error('Account not found');
    }

    return {
        accountId,
        user,
        userId,
    };
}

export async function withAuth<TUser extends UserBase>(
    config: AuthConfigInitialized<TUser>,
    handler: (ctx: WithAuthContext<TUser>) => Promise<Response>,
): Promise<Response> {
    try {
        return await handler(await auth(config));
    } catch {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
}

function resolveExpirationTime(expirationTime: string | number | Date) {
    if (typeof expirationTime === 'number') {
        return new Date(Date.now() + expirationTime);
    }

    return expirationTime;
}

export async function createJwt<TUser extends UserBase>(
    config: AuthConfigInitialized<TUser>['jwt'],
    userId: string,
    expirationTime?: string | number | Date,
): Promise<string> {
    return new SignJWT()
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setIssuer(issuer(config))
        .setAudience(audience(config))
        .setExpirationTime(
            resolveExpirationTime(expirationTime ?? config.expiry),
        )
        .setSubject(userId)
        .sign(await config.jwtSecretFactory());
}

export async function setCookie<TUser extends UserBase>(
    config: AuthConfigInitialized<TUser>['cookie'],
    cookieValue: Promise<string> | string,
    expiry?: number,
) {
    (await cookies()).set(config.name, await cookieValue, {
        expires: new Date(Date.now() + (expiry ?? config.expiry)),
        httpOnly: true,
        sameSite: 'strict',
        secure: true,
    });
}

export async function clearCookie<TUser extends UserBase>(
    config: AuthConfigInitialized<TUser>['cookie'],
) {
    const cookieStore = await cookies();

    if (cookieStore.has(config.name)) {
        cookieStore.delete(config.name);
    }
}

export type initAuthResult<TUser extends UserBase> = {
    auth: () => Promise<AuthContext<TUser>>;
    withAuth: (
        handler: (ctx: WithAuthContext<TUser>) => Promise<Response>,
    ) => Promise<Response>;
    createJwt: (
        userId: string,
        expirationTime?: string | number | Date,
        overrideConfig?: Partial<AuthConfig<TUser>['jwt']>,
    ) => Promise<string>;
    verifyJwt: (
        token: string,
        overrideConfig?: Partial<AuthConfig<TUser>['jwt']>,
    ) => ReturnType<typeof verifyToken<TUser>>;
    setCookie: (
        cookieValue: Promise<string> | string,
        expiry?: number,
        overrideConfig?: Partial<AuthConfig<TUser>['cookie']>,
    ) => Promise<void>;
    clearCookie: (
        overrideConfig?: Partial<AuthConfig<TUser>['cookie']>,
    ) => Promise<void>;
};

function defaultGetUser(): never {
    throw new Error('Not implemented');
}

function defaultJwtSecretFactory(): never {
    throw new Error('Not implemented');
}

function initializeAuthConfig<TUser extends UserBase>(
    config: AuthConfig<TUser>,
): AuthConfigInitialized<TUser> {
    const securityExpiry = config.security?.expiry ?? 3600000;

    return {
        getUser: config.getUser ?? defaultGetUser,
        security: {
            expiry: securityExpiry,
        },
        jwt: {
            audience: config.jwt?.audience ?? 'web',
            expiry: config.jwt?.expiry ?? securityExpiry,
            issuer: config.jwt?.issuer ?? 'api',
            jwtSecretFactory:
                config.jwt?.jwtSecretFactory ?? defaultJwtSecretFactory,
            namespace: config.jwt?.namespace ?? 'app',
        },
        cookie: {
            expiry: config.cookie?.expiry ?? securityExpiry,
            name: config.cookie?.name ?? 'auth_session',
        },
    };
}

export function initAuth<TUser extends UserBase>(
    config: AuthConfig<TUser>,
): initAuthResult<TUser> {
    const initializedConfig = initializeAuthConfig(config);

    return {
        auth: () => auth(initializedConfig),
        clearCookie: (overrideConfig) =>
            clearCookie({
                ...initializedConfig.cookie,
                ...overrideConfig,
            }),
        createJwt: (userId, expirationTime, overrideConfig) =>
            createJwt(
                {
                    ...initializedConfig.jwt,
                    ...overrideConfig,
                },
                userId,
                expirationTime,
            ),
        setCookie: (cookieValue, expiry, overrideConfig) =>
            setCookie(
                {
                    ...initializedConfig.cookie,
                    ...overrideConfig,
                },
                cookieValue,
                expiry,
            ),
        verifyJwt: (token, overrideConfig) =>
            verifyToken(
                {
                    ...initializedConfig.jwt,
                    ...overrideConfig,
                },
                token,
            ),
        withAuth: (handler) => withAuth(initializedConfig, handler),
    };
}

function ensureRole<TUser extends RbacUserBase>(roles: string[], user: TUser) {
    if (!roles.includes(user.role)) {
        throw new Error('Unauthorized');
    }
}

export type initRbacResult<TUser extends RbacUserBase> = Omit<
    initAuthResult<TUser>,
    'auth' | 'withAuth'
> & {
    auth: (roles: string[]) => Promise<AuthContext<TUser>>;
    withAuth: (
        roles: string[],
        handler: (ctx: WithAuthContext<TUser>) => Promise<Response>,
    ) => Promise<Response>;
};

export function initRbac<TUser extends RbacUserBase>({
    auth: baseAuth,
    withAuth: baseWithAuth,
    ...rest
}: initAuthResult<TUser>): initRbacResult<TUser> {
    return {
        ...rest,
        auth: async (roles) => {
            const authContext = await baseAuth();
            ensureRole(roles, authContext.user);
            return authContext;
        },
        withAuth: async (roles, handler) =>
            baseWithAuth(async (authContext) => {
                ensureRole(roles, authContext.user);
                return await handler(authContext);
            }),
    };
}
