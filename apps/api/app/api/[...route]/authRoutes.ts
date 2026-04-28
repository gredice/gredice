import { pbkdf2Sync, randomUUID } from 'node:crypto';
import { notifyNewUserRegistered } from '@gredice/notifications';
import {
    blockLogin,
    changePassword,
    clearLoginFailedAttempts,
    createOrUpdateUserWithOauth,
    createUserPasswordLogin,
    createUserWithPassword,
    doUseRefreshToken,
    getLastUserLogin,
    getUser,
    getUserWithLogins,
    incLoginFailedAttempts,
    loginSuccessful,
    updateLoginData,
} from '@gredice/storage';
import { type Context, Hono } from 'hono';
import {
    deleteCookie as deleteContextCookie,
    getCookie,
    setCookie as setContextCookie,
} from 'hono/cookie';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import {
    clearCookie,
    createJwt,
    setCookie,
    verifyJwt,
} from '../../../lib/auth/auth';
import {
    sendChangePassword,
    sendEmailVerification,
} from '../../../lib/auth/email';
import {
    exchangeCodeForToken,
    fetchUserInfo,
    generateAuthUrl,
} from '../../../lib/auth/oauth';
import {
    clearRefreshCookie,
    setRefreshCookie,
} from '../../../lib/auth/refreshCookies';
import { refreshTokenCookieName } from '../../../lib/auth/sessionConfig';
import {
    issueSessionTokens,
    revokeSessionToken,
} from '../../../lib/auth/sessionTokens';
import { sendWelcome } from '../../../lib/email/transactional';
import { getPostHogClient } from '../../../lib/posthog-server';

const failedAttemptClearTime = 1000 * 60; // 1 minute
const failedAttemptsBlock = 5;
const failedAttemptsBlockTime = 1000 * 60 * 60; // 1 hour

/**
 * Reads the session cookie and, if valid, creates a short-lived JWT
 * to use as the OAuth state so the callback can link the provider
 * to the current user.
 */
async function createOAuthStateFromSession(context: Context): Promise<string> {
    const sessionCookie = getCookie(context, 'gredice_session');
    if (sessionCookie) {
        try {
            const { result, error } = await verifyJwt(sessionCookie);
            if (!error && result?.payload.sub) {
                return createJwt(result.payload.sub, '10m');
            }
        } catch {
            // Not authenticated – fall through to random UUID
        }
    }
    return randomUUID().toString().replace('-', '');
}

const defaultWebAppOrigin = 'https://vrt.gredice.com';
const oauthRedirectCookieName = 'oauth_redirect';
const oauthTimeZoneCookieName = 'oauth_timezone';
const allowedLocalRedirectHosts = new Set([
    'localhost',
    '127.0.0.1',
    'app.gredice.test',
    'vrt.gredice.test',
    'farma.gredice.test',
]);

function sanitizeRedirectUrl(redirectUrl?: string) {
    if (!redirectUrl) {
        return undefined;
    }

    try {
        const parsed = new URL(redirectUrl);
        const hostname = parsed.hostname.toLowerCase();
        const isSecureProtocol =
            parsed.protocol === 'https:' ||
            (parsed.protocol === 'http:' &&
                allowedLocalRedirectHosts.has(hostname));
        if (!isSecureProtocol) {
            return undefined;
        }

        if (
            hostname === 'gredice.com' ||
            hostname.endsWith('.gredice.com') ||
            allowedLocalRedirectHosts.has(hostname)
        ) {
            return parsed.toString();
        }
    } catch {
        return undefined;
    }

    return undefined;
}

function storeRedirectCookie(context: Context, redirectUrl?: string) {
    const sanitized = sanitizeRedirectUrl(redirectUrl);
    if (!sanitized) {
        deleteContextCookie(context, oauthRedirectCookieName);
        return;
    }

    setContextCookie(context, oauthRedirectCookieName, sanitized, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 600,
    });
}

function storeTimeZoneCookie(context: Context, timeZone?: string) {
    if (!timeZone) {
        deleteContextCookie(context, oauthTimeZoneCookieName);
        return;
    }
    // Basic validation: timezone should be a reasonable IANA timezone string
    if (!/^[A-Za-z_]+\/[A-Za-z_]+/.test(timeZone)) {
        deleteContextCookie(context, oauthTimeZoneCookieName);
        return;
    }
    setContextCookie(context, oauthTimeZoneCookieName, timeZone, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 600,
    });
}

function getTimeZoneCookie(context: Context): string | undefined {
    const timeZone = getCookie(context, oauthTimeZoneCookieName);
    deleteContextCookie(context, oauthTimeZoneCookieName);
    return timeZone;
}

function resolveRedirectUrl(context: Context, fallbackPath: string) {
    const fallbackUrl = new URL(fallbackPath, defaultWebAppOrigin);
    const stored = getCookie(context, oauthRedirectCookieName);
    if (!stored) {
        return fallbackUrl;
    }

    deleteContextCookie(context, oauthRedirectCookieName);
    const sanitized = sanitizeRedirectUrl(stored);
    if (!sanitized) {
        return fallbackUrl;
    }

    try {
        return new URL(sanitized);
    } catch {
        return fallbackUrl;
    }
}

type AuthProvider = 'password' | 'google' | 'facebook';

type TrackAuthEventInput = {
    distinctId: string;
    event: string;
    email?: string;
    provider?: AuthProvider;
    properties?: Record<string, unknown>;
    setProperties?: Record<string, unknown>;
    setOnceProperties?: Record<string, unknown>;
};

function normalizeEmail(email?: string) {
    return email?.trim().toLowerCase();
}

function getEmailDomain(email?: string) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return undefined;
    }

    const atIndex = normalizedEmail.lastIndexOf('@');
    if (atIndex === -1 || atIndex === normalizedEmail.length - 1) {
        return undefined;
    }

    return normalizedEmail.slice(atIndex + 1);
}

function compactProperties(properties: Record<string, unknown>) {
    const compacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
        if (value !== undefined) {
            compacted[key] = value;
        }
    }
    return compacted;
}

async function trackAuthEvent({
    distinctId,
    event,
    email,
    provider,
    properties,
    setProperties,
    setOnceProperties,
}: TrackAuthEventInput) {
    const normalizedEmail = normalizeEmail(email);
    const eventProperties = compactProperties({
        email_domain: getEmailDomain(normalizedEmail),
        provider,
        ...properties,
    });
    const personProperties = compactProperties({
        auth_provider: provider,
        email: normalizedEmail,
        ...setProperties,
    });
    const personPropertiesOnce = compactProperties({
        ...setOnceProperties,
    });

    await (await getPostHogClient()).capture({
        distinctId,
        event,
        properties: compactProperties({
            ...eventProperties,
            ...(Object.keys(personProperties).length > 0
                ? { $set: personProperties }
                : {}),
            ...(Object.keys(personPropertiesOnce).length > 0
                ? { $set_once: personPropertiesOnce }
                : {}),
        }),
    });
}

const app = new Hono()
    .post(
        '/login',
        describeRoute({
            description: 'Login with email and password',
        }),
        zValidator(
            'json',
            z.object({
                email: z.string(),
                password: z.string(),
            }),
        ),
        async (context) => {
            const { email, password } = context.req.valid('json');
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User not found', email);
                return context.json(
                    {
                        error: 'User not found',
                        errorCode: 'user_not_found',
                    },
                    { status: 404 },
                );
            }

            const login = user.usersLogins.find(
                (login) => login.loginType === 'password',
            );
            if (!login) {
                console.debug('User login not found', email);
                return context.json(
                    {
                        error: 'User not found',
                        errorCode: 'user_not_found',
                    },
                    { status: 404 },
                );
            }

            // TODO: Move to Auth library
            // Check if user is blocked
            if (
                login.blockedUntil &&
                login.blockedUntil.getTime() > Date.now()
            ) {
                console.debug('User blocked', email);
                return context.json(
                    {
                        error: 'User blocked',
                        errorCode: 'user_blocked',
                        blockedUntil: login.blockedUntil.toISOString(),
                    },
                    { status: 404 },
                );
            }

            // Extract salt and password hash from login
            const { salt, password: storedHash } = JSON.parse(login.loginData);
            if (!salt || !storedHash) {
                console.debug(
                    'User password login data corrupted',
                    email,
                    login.id,
                );
                return context.json(
                    {
                        error: 'User not found',
                        errorCode: 'user_not_found',
                    },
                    { status: 404 },
                );
            }

            // Check if password is correct
            const checkHash = pbkdf2Sync(
                password,
                salt,
                10000,
                512,
                'sha512',
            ).toString('hex');
            if (checkHash !== storedHash) {
                console.debug('User password not matching', email);

                // TODO: Move to Auth library
                // Clear failed attempts after some time or block user
                // then increment failed attempts in any case
                if (
                    login.lastFailedAttempt &&
                    login.lastFailedAttempt.getTime() + failedAttemptClearTime <
                        Date.now()
                ) {
                    await clearLoginFailedAttempts(login.id);
                } else if (login.failedAttempts + 1 >= failedAttemptsBlock) {
                    await blockLogin(
                        login.id,
                        new Date(Date.now() + failedAttemptsBlockTime),
                    );
                }
                await incLoginFailedAttempts(login.id);

                return context.json(
                    {
                        error: 'User login failed attempt',
                        errorCode: 'login_failed',
                        leftAttempts:
                            failedAttemptsBlock - login.failedAttempts,
                    },
                    { status: 404 },
                );
            }

            // TODO: Move to Auth library
            // Clear failed attempts on successful login
            if (login.failedAttempts > 0) {
                await clearLoginFailedAttempts(login.id);
            }

            // Check email verified
            const { isVerified } = JSON.parse(login.loginData);
            if (isVerified !== true) {
                console.warn('User email not verified', email);
                return context.json(
                    {
                        error: 'User email not verified',
                        errorCode: 'verify_email',
                    },
                    { status: 403 },
                );
            }

            const { accessToken, refreshToken } = await issueSessionTokens(
                user.id,
            );
            await Promise.all([
                setCookie(context, accessToken),
                loginSuccessful(login.id),
                setRefreshCookie(context, refreshToken),
            ]);

            await trackAuthEvent({
                distinctId: user.id,
                email: user.userName,
                event: 'user_logged_in',
                provider: 'password',
            });

            return context.json({
                token: accessToken,
                refreshToken,
            });
        },
    )
    .get(
        '/google',
        describeRoute({
            description: 'Redirect to Google OAuth login',
        }),
        zValidator(
            'query',
            z.object({
                redirect: z.string().optional(),
                timeZone: z.string().optional(),
            }),
        ),
        async (context) => {
            const query = context.req.valid('query');
            const state = await createOAuthStateFromSession(context);
            storeRedirectCookie(context, query?.redirect);
            storeTimeZoneCookie(context, query?.timeZone);
            const authUrl = generateAuthUrl('google', state);

            // Store state in cookie for verification
            setContextCookie(context, 'oauth_state', state, {
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
                maxAge: 600,
            });

            return context.redirect(authUrl);
        },
    )
    .get(
        '/google/callback',
        describeRoute({
            description: 'Google OAuth callback',
        }),
        async (context) => {
            try {
                const code = context.req.query('code');
                const state = context.req.query('state');
                if (!code || !state) {
                    return context.json(
                        { message: 'Missing code or state' },
                        400,
                    );
                }

                let currentUserId: string | undefined;
                try {
                    const { result, error } = await verifyJwt(state);
                    if (error || !result?.payload.sub) {
                        throw new Error('Invalid state token');
                    }
                    currentUserId = result.payload.sub;
                    console.debug(
                        'User authenticated',
                        currentUserId,
                        'proceeding with OAuth flow and existing user assignment',
                    );
                } catch {
                    // Note: this means user is not authenticated, and we can proceed with
                    // user creation but will not allow provider assignment to existing user
                    console.debug(
                        'User not authenticated, proceeding with OAuth flow without existing user assignment',
                    );
                }

                const tokenData = await exchangeCodeForToken('google', code);
                const userInfo = await fetchUserInfo(
                    'google',
                    tokenData.access_token,
                );
                const timeZone = getTimeZoneCookie(context);
                const { userId, loginId, isNewUser } =
                    await createOrUpdateUserWithOauth(
                        {
                            name: userInfo.name,
                            email: userInfo.email,
                            providerUserId: userInfo.id,
                            provider: 'google',
                        },
                        currentUserId,
                        timeZone,
                    );

                if (isNewUser) {
                    await notifyNewUserRegistered(userId);
                }

                const { accessToken, refreshToken } =
                    await issueSessionTokens(userId);
                await Promise.all([
                    setCookie(context, accessToken),
                    loginSuccessful(loginId),
                    setRefreshCookie(context, refreshToken),
                ]);

                await trackAuthEvent({
                    distinctId: userId,
                    email: userInfo.email,
                    event: isNewUser ? 'user_signed_up' : 'user_logged_in',
                    provider: 'google',
                    setProperties: {
                        name: userInfo.name,
                    },
                    setOnceProperties: isNewUser
                        ? {
                              signed_up_at: new Date().toISOString(),
                              signup_provider: 'google',
                          }
                        : undefined,
                });

                if (currentUserId && !isNewUser) {
                    await trackAuthEvent({
                        distinctId: userId,
                        email: userInfo.email,
                        event: 'user_auth_method_added',
                        provider: 'google',
                        properties: {
                            auth_method: 'google',
                        },
                        setProperties: {
                            name: userInfo.name,
                        },
                    });
                }

                const redirectUrl = resolveRedirectUrl(
                    context,
                    '/prijava/google-prijava/povratak',
                );
                // Pass tokens to frontend via URL fragment (hash) so they don't appear in logs/referrer
                redirectUrl.hash = `token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;

                return context.redirect(redirectUrl.toString());
            } catch (error) {
                console.error('Google OAuth error:', error);
                const redirectUrl = resolveRedirectUrl(
                    context,
                    '/prijava/google-prijava/povratak',
                );
                redirectUrl.searchParams.set('error', 'oauth_error');

                return context.redirect(redirectUrl.toString());
            }
        },
    )
    .get(
        '/facebook',
        describeRoute({
            description: 'Redirect to Facebook OAuth login',
        }),
        zValidator(
            'query',
            z.object({
                redirect: z.string().optional(),
                timeZone: z.string().optional(),
            }),
        ),
        async (context) => {
            const query = context.req.valid('query');
            const state = await createOAuthStateFromSession(context);
            const authUrl = generateAuthUrl('facebook', state);

            // Store state in cookie for verification
            storeRedirectCookie(context, query?.redirect);
            storeTimeZoneCookie(context, query?.timeZone);
            setContextCookie(context, 'oauth_state', state, {
                httpOnly: true,
                secure: true,
                sameSite: 'Lax',
                maxAge: 600,
            });

            return context.redirect(authUrl);
        },
    )
    .get(
        '/facebook/callback',
        describeRoute({
            description: 'Facebook OAuth callback',
        }),
        async (context) => {
            try {
                const code = context.req.query('code');
                const state = context.req.query('state');
                if (!code || !state) {
                    return context.json(
                        { message: 'Missing code or state' },
                        400,
                    );
                }

                let currentUserId: string | undefined;
                try {
                    const { result, error } = await verifyJwt(state);
                    if (error || !result?.payload.sub) {
                        throw new Error('Invalid state token');
                    }
                    currentUserId = result.payload.sub;
                    console.debug(
                        'User authenticated',
                        currentUserId,
                        'proceeding with OAuth flow and existing user assignment',
                    );
                } catch {
                    // Note: this means user is not authenticated, and we can proceed with
                    // user creation but will not allow provider assignment to existing user
                    console.debug(
                        'User not authenticated, proceeding with OAuth flow without existing user assignment',
                    );
                }

                const tokenData = await exchangeCodeForToken('facebook', code);
                const userInfo = await fetchUserInfo(
                    'facebook',
                    tokenData.access_token,
                );
                const timeZone = getTimeZoneCookie(context);
                const { userId, loginId, isNewUser } =
                    await createOrUpdateUserWithOauth(
                        {
                            name: userInfo.name,
                            email: userInfo.email,
                            providerUserId: userInfo.id,
                            provider: 'facebook',
                        },
                        currentUserId,
                        timeZone,
                    );

                if (isNewUser) {
                    await notifyNewUserRegistered(userId);
                }

                const { accessToken, refreshToken } =
                    await issueSessionTokens(userId);
                await Promise.all([
                    setCookie(context, accessToken),
                    loginSuccessful(loginId),
                    setRefreshCookie(context, refreshToken),
                ]);

                await trackAuthEvent({
                    distinctId: userId,
                    email: userInfo.email,
                    event: isNewUser ? 'user_signed_up' : 'user_logged_in',
                    provider: 'facebook',
                    setProperties: {
                        name: userInfo.name,
                    },
                    setOnceProperties: isNewUser
                        ? {
                              signed_up_at: new Date().toISOString(),
                              signup_provider: 'facebook',
                          }
                        : undefined,
                });

                if (currentUserId && !isNewUser) {
                    await trackAuthEvent({
                        distinctId: userId,
                        email: userInfo.email,
                        event: 'user_auth_method_added',
                        provider: 'facebook',
                        properties: {
                            auth_method: 'facebook',
                        },
                        setProperties: {
                            name: userInfo.name,
                        },
                    });
                }

                const redirectUrl = resolveRedirectUrl(
                    context,
                    '/prijava/facebook-prijava/povratak',
                );
                // Pass tokens to frontend via URL fragment (hash) so they don't appear in logs/referrer
                redirectUrl.hash = `token=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;

                return context.redirect(redirectUrl.toString());
            } catch (error) {
                console.error('Facebook OAuth error:', error);
                const redirectUrl = resolveRedirectUrl(
                    context,
                    '/prijava/facebook-prijava/povratak',
                );
                redirectUrl.searchParams.set('error', 'oauth_error');

                return context.redirect(redirectUrl.toString());
            }
        },
    )
    .get(
        '/current-claims',
        describeRoute({
            description:
                'Get basic current user claims from a verified session token.',
        }),
        async (context) => {
            const sessionCookie = getCookie(context, 'gredice_session');
            if (!sessionCookie) {
                return context.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const { result, error } = await verifyJwt(sessionCookie);
            const payload = result?.payload;
            const claims = payload?.gredice;
            const accountIds = claims?.accountIds;
            if (
                error ||
                typeof payload?.sub !== 'string' ||
                typeof claims?.userName !== 'string' ||
                typeof claims?.role !== 'string' ||
                !Array.isArray(accountIds) ||
                accountIds.some((accountId) => typeof accountId !== 'string')
            ) {
                return context.json({ error: 'Unauthorized' }, { status: 401 });
            }

            return context.json({
                id: payload.sub,
                userName: claims.userName,
                role: claims.role,
                accountIds,
            });
        },
    )
    .get(
        '/last-login',
        describeRoute({
            description: 'Get last login for the current user',
        }),
        async (context) => {
            const refreshToken = getCookie(context, refreshTokenCookieName);
            if (!refreshToken) {
                return context.json({ provider: null });
            }

            const refreshed = await doUseRefreshToken(refreshToken);
            if (!refreshed) {
                await clearRefreshCookie(context);
                return context.json({ provider: null });
            }

            const login = await getLastUserLogin(refreshed.userId);
            return context.json({
                provider: login?.loginType ?? null,
            });
        },
    )
    .post(
        '/change-password',
        describeRoute({
            description: 'Change password using token from email',
        }),
        zValidator(
            'json',
            z.object({
                password: z.string(),
                token: z.string(),
            }),
        ),
        async (context) => {
            const { password, token } = context.req.valid('json');

            // Read email from JWT token and verify it
            const { result, error } = await verifyJwt(token, {
                expiry: '1h',
            });
            const emailOrUserId = result?.payload.sub;
            if (!emailOrUserId) {
                console.warn('Token is invalid', error);
                return context.json(
                    {
                        error: 'Token is invalid',
                    },
                    { status: 400 },
                );
            }

            // Get user with logins (via email)
            let userWithLogins = await getUserWithLogins(emailOrUserId);
            if (!userWithLogins) {
                const user = await getUser(emailOrUserId);
                if (user) {
                    userWithLogins = await getUserWithLogins(user.userName);
                }
                if (!userWithLogins) {
                    console.debug('User does not exist', emailOrUserId);
                    return context.json(
                        {
                            error: 'User not found',
                        },
                        { status: 404 },
                    );
                }
            }

            // Set email as verified
            const userLogin = userWithLogins.usersLogins.find(
                (login) =>
                    login.loginId === emailOrUserId &&
                    login.loginType === 'password',
            );
            const isAddingPasswordLogin = !userLogin;
            if (!userLogin) {
                console.debug(
                    'User password login not found',
                    emailOrUserId,
                    'creating password login...',
                );
                await createUserPasswordLogin(
                    userWithLogins.id,
                    emailOrUserId,
                    password,
                );
            } else {
                console.debug(
                    'User password login found',
                    emailOrUserId,
                    'updating password...',
                );
                await changePassword(userLogin.id, password);
            }

            if (isAddingPasswordLogin) {
                await trackAuthEvent({
                    distinctId: userWithLogins.id,
                    email: userWithLogins.userName,
                    event: 'user_auth_method_added',
                    provider: 'password',
                    properties: {
                        auth_method: 'password',
                        source: 'change_password',
                    },
                });
            }

            await trackAuthEvent({
                distinctId: userWithLogins.id,
                email: userWithLogins.userName,
                event: 'password_changed',
                provider: 'password',
            });

            return context.json({
                message: 'Password changed successfully',
            });
        },
    )
    .post(
        '/logout',
        describeRoute({
            description: 'Logout user by clearing the session cookie',
        }),
        async (context) => {
            const sessionCookie = getCookie(context, 'gredice_session');
            let userId: string | undefined;
            if (sessionCookie) {
                try {
                    const { result } = await verifyJwt(sessionCookie);
                    userId = result?.payload.sub ?? undefined;
                } catch {
                    // ignore
                }
            }
            const refreshToken = getCookie(context, refreshTokenCookieName);
            if (refreshToken) {
                await revokeSessionToken(refreshToken);
            }
            await clearCookie(context);
            await clearRefreshCookie(context);
            if (userId) {
                await trackAuthEvent({
                    distinctId: userId,
                    event: 'user_logged_out',
                });
            }
            return context.json({
                message: 'Logged out successfully',
            });
        },
    )
    .post(
        '/register',
        describeRoute({
            description: 'Register a new user with email and password',
        }),
        zValidator(
            'json',
            z.object({
                email: z.string(),
                password: z.string(),
            }),
        ),
        async (context) => {
            const { email, password } = context.req.valid('json');
            const user = await getUserWithLogins(email);
            if (user) {
                console.debug('User already exists', email);
                await trackAuthEvent({
                    distinctId: user.id,
                    email: user.userName,
                    event: 'user_signup_failed',
                    provider: 'password',
                    properties: {
                        reason: 'already_exists',
                    },
                });
                // TODO: Instead, do login flow (redirect to login url)
                return context.json(
                    {
                        error: 'User already exists',
                    },
                    { status: 400 },
                );
            }

            // Create user with password
            const userId = await createUserWithPassword(email, password);

            await trackAuthEvent({
                distinctId: userId,
                email,
                event: 'user_signed_up',
                provider: 'password',
                setOnceProperties: {
                    signed_up_at: new Date().toISOString(),
                    signup_provider: 'password',
                },
            });

            await notifyNewUserRegistered(userId);

            await sendEmailVerification(email);

            await trackAuthEvent({
                distinctId: userId,
                email,
                event: 'user_verification_email_sent',
                provider: 'password',
                properties: {
                    trigger: 'signup',
                },
            });

            return context.json(
                {
                    message: 'User created successfully',
                },
                { status: 201 },
            );
        },
    )
    .post(
        '/send-change-password-email',
        describeRoute({
            description: 'Send change password email to user',
        }),
        zValidator(
            'json',
            z.object({
                email: z.string(),
            }),
        ),
        async (context) => {
            const { email } = context.req.valid('json');
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User does not exist', email);
                return context.json(
                    {
                        error: 'User not found',
                    },
                    { status: 404 },
                );
            }

            // Send email
            await sendChangePassword(email);

            await trackAuthEvent({
                distinctId: user.id,
                email: user.userName,
                event: 'password_reset_requested',
                provider: 'password',
            });

            return context.json({
                message: 'Change password email sent successfully',
            });
        },
    )
    .post(
        '/send-verify-email',
        describeRoute({
            description: 'Send email verification to user',
        }),
        zValidator(
            'json',
            z.object({
                email: z.string(),
            }),
        ),
        async (context) => {
            const { email } = context.req.valid('json');
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User does not exist', email);
                return context.json(
                    {
                        error: 'User not found',
                    },
                    { status: 404 },
                );
            }

            // Send email
            await sendEmailVerification(email);

            await trackAuthEvent({
                distinctId: user.id,
                email: user.userName,
                event: 'user_verification_email_sent',
                provider: 'password',
                properties: {
                    trigger: 'manual',
                },
            });

            return context.json({
                message: 'Verify email sent successfully',
            });
        },
    )
    .post(
        '/verify-email',
        describeRoute({
            description: 'Verify user email using token from email',
        }),
        zValidator(
            'json',
            z.object({
                token: z.string(),
            }),
        ),
        async (context) => {
            const { token } = context.req.valid('json');

            // Read email from JWT token and verify it
            const { result, error } = await verifyJwt(token, {
                expiry: '1h',
            });
            const email = result?.payload.sub;
            if (!email) {
                console.warn('Token is invalid', error);
                return context.json(
                    {
                        error: 'Token is invalid',
                    },
                    { status: 400 },
                );
            }

            // Get user with logins
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User does not exist', email);
                return context.json(
                    {
                        error: 'Token is invalid',
                    },
                    { status: 400 },
                );
            }

            // Set email as verified (idempotent)
            const userLogin = user.usersLogins.find(
                (login) =>
                    login.loginId === email && login.loginType === 'password',
            );
            if (!userLogin) {
                console.debug('User login not found', email);
                return context.json(
                    {
                        error: 'Token is invalid',
                    },
                    { status: 400 },
                );
            }
            const loginData = JSON.parse(userLogin.loginData);

            // Helper to log in and respond
            async function loginAndRespond(alreadyVerified: boolean = false) {
                if (!user || !userLogin) {
                    console.debug('User or user login not found', email);
                    throw new Error('User or user login not found');
                }

                const { accessToken, refreshToken } = await issueSessionTokens(
                    user.id,
                );
                await Promise.all([
                    setCookie(context, accessToken),
                    loginSuccessful(userLogin.id),
                    setRefreshCookie(context, refreshToken),
                ]);
                return context.json({
                    token: accessToken,
                    refreshToken,
                    ...(alreadyVerified ? { alreadyVerified: true } : {}),
                });
            }

            if (loginData.isVerified === true) {
                // Already verified
                return await loginAndRespond(true);
            }
            await updateLoginData(userLogin.id, {
                ...loginData,
                isVerified: true,
            });

            await trackAuthEvent({
                distinctId: user.id,
                email: user.userName,
                event: 'user_email_verified',
                provider: 'password',
                properties: {
                    verification_method: 'email_link',
                },
            });

            // Send welcome message
            await sendWelcome(email, {
                email,
                ctaUrl: 'https://vrt.gredice.com',
            });

            return loginAndRespond(false);
        },
    );

export default app;
