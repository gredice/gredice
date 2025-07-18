import { Hono } from 'hono';
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { blockLogin, changePassword, clearLoginFailedAttempts, createOrUpdateUserWithOauth, createUserPasswordLogin, createUserWithPassword, getUser, getUserWithLogins, incLoginFailedAttempts, loginSuccessful, updateLoginData } from '@gredice/storage';
import { pbkdf2Sync, randomUUID } from 'node:crypto';
import { clearCookie, createJwt, verifyJwt, setCookie } from '../../../lib/auth/auth';
import { sendChangePassword, sendEmailVerification } from '../../../lib/auth/email';
import { sendWelcome } from '../../../lib/email/transactional';
import { exchangeCodeForToken, fetchUserInfo, generateAuthUrl } from '../../../lib/auth/oauth';
import { describeRoute } from 'hono-openapi';

const failedAttemptClearTime = 1000 * 60; // 1 minute
const failedAttemptsBlock = 5;
const failedAttemptsBlockTime = 1000 * 60 * 60; // 1 hour

const app = new Hono()
    .post(
        '/login',
        describeRoute({
            description: 'Login with email and password',
        }),
        zValidator(
            "json",
            z.object({
                email: z.string(),
                password: z.string(),
            })
        ),
        async (context) => {
            const { email, password } = context.req.valid('json');
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User not found', email);
                return context.json({
                    error: 'User not found',
                    errorCode: 'user_not_found'
                }, { status: 404 });
            }

            const login = user.usersLogins.find(login => login.loginType === 'password');
            if (!login) {
                console.debug('User login not found', email);
                return context.json({
                    error: 'User not found',
                    errorCode: 'user_not_found'
                }, { status: 404 });
            }

            // TODO: Move to Auth library
            // Check if user is blocked
            if (login.blockedUntil && login.blockedUntil.getTime() > Date.now()) {
                console.debug('User blocked', email);
                return context.json({
                    error: 'User blocked',
                    errorCode: 'user_blocked',
                    blockedUntil: login.blockedUntil.toISOString()
                }, { status: 404 });
            }

            // Extract salt and password hash from login
            const { salt, password: storedHash } = JSON.parse(login.loginData);
            if (!salt || !storedHash) {
                console.debug('User password login data corrupted', email, login.id);
                return context.json({
                    error: 'User not found',
                    errorCode: 'user_not_found'
                }, { status: 404 });
            }

            // Check if password is correct
            const checkHash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
            if (checkHash !== storedHash) {
                console.debug('User password not matching', email);

                // TODO: Move to Auth library
                // Clear failed attempts after some time or block user
                // then increment failed attempts in any case
                if (login.lastFailedAttempt && login.lastFailedAttempt.getTime() + failedAttemptClearTime < Date.now()) {
                    await clearLoginFailedAttempts(login.id);
                } else if (login.failedAttempts + 1 >= failedAttemptsBlock) {
                    await blockLogin(login.id, new Date(Date.now() + failedAttemptsBlockTime));
                }
                await incLoginFailedAttempts(login.id);

                return context.json({
                    error: 'User login failed attempt',
                    errorCode: 'login_failed',
                    leftAttempts: failedAttemptsBlock - login.failedAttempts
                }, { status: 404 });
            }

            // TODO: Move to Auth library
            // Clear failed attempts on successful login
            if (login.failedAttempts > 0) {
                await clearLoginFailedAttempts(login.id);
            }

            // Check email verified
            const { isVerified } = JSON.parse(login.loginData)
            if (isVerified !== true) {
                console.warn('User email not verified', email);
                return context.json({
                    error: 'User email not verified',
                    errorCode: 'verify_email'
                }, { status: 403 });
            }

            const token = await createJwt(user.id);
            await Promise.all([
                setCookie(context, token),
                loginSuccessful(login.id)
            ]);

            return context.json({
                token
            });
        })
    .get(
        "/google",
        describeRoute({
            description: 'Redirect to Google OAuth login',
        }),
        zValidator(
            "query",
            z.object({
                state: z.string().optional(),
            })
        ),
        async (context) => {
            const state = context.req.valid('query')?.state ?? randomUUID().toString().replace('-', '');
            const authUrl = generateAuthUrl("google", state)

            // Store state in cookie for verification
            context.header("Set-Cookie", `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)

            return context.redirect(authUrl)
        })
    .get(
        "/google/callback",
        describeRoute({
            description: 'Google OAuth callback',
        }),
        async (context) => {
            try {
                const code = context.req.query("code")
                const state = context.req.query("state")
                if (!code || !state) {
                    return context.json({ message: "Missing code or state" }, 400)
                }

                let currentUserId: string | undefined;
                try {
                    const { result, error } = await verifyJwt(state);
                    if (error || !result?.payload.sub) {
                        throw new Error("Invalid state token");
                    }
                    currentUserId = result.payload.sub;
                    console.debug('User authenticated', currentUserId, 'proceeding with OAuth flow and existing user assignment');
                } catch {
                    // Note: this means user is not authenticated, and we can proceed with 
                    // user creation but will not allow provider assignment to existing user
                    console.debug('User not authenticated, proceeding with OAuth flow without existing user assignment');
                }

                const tokenData = await exchangeCodeForToken("google", code)
                const userInfo = await fetchUserInfo("google", tokenData.access_token)
                const { userId, loginId } = await createOrUpdateUserWithOauth({
                    name: userInfo.name,
                    email: userInfo.email,
                    providerUserId: userInfo.id,
                    provider: "google",
                }, currentUserId);

                const token = await createJwt(userId);
                await Promise.all([
                    setCookie(context, token),
                    loginSuccessful(loginId)
                ]);

                return context.redirect(`https://vrt.gredice.com/prijava/google-prijava/povratak?session=${token}`)
            } catch (error) {
                console.error("Google OAuth error:", error)
                return context.redirect("https://vrt.gredice.com/prijava/google-prijava/povratak?error=oauth_error")
            }
        })
    .get(
        "/facebook",
        describeRoute({
            description: 'Redirect to Facebook OAuth login',
        }),
        zValidator(
            "query",
            z.object({
                state: z.string().optional(),
            })
        ),
        async (context) => {
            const state = context.req.valid('query')?.state ?? randomUUID().toString().replace('-', '');
            const authUrl = generateAuthUrl("facebook", state)

            // Store state in cookie for verification
            context.header("Set-Cookie", `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)

            return context.redirect(authUrl)
        })
    .get(
        "/facebook/callback",
        describeRoute({
            description: 'Facebook OAuth callback',
        }),
        async (context) => {
            try {
                const code = context.req.query("code")
                const state = context.req.query("state")
                if (!code || !state) {
                    return context.json({ message: "Missing code or state" }, 400)
                }

                let currentUserId: string | undefined;
                try {
                    const { result, error } = await verifyJwt(state);
                    if (error || !result?.payload.sub) {
                        throw new Error("Invalid state token");
                    }
                    currentUserId = result.payload.sub;
                    console.debug('User authenticated', currentUserId, 'proceeding with OAuth flow and existing user assignment');
                } catch {
                    // Note: this means user is not authenticated, and we can proceed with 
                    // user creation but will not allow provider assignment to existing user
                    console.debug('User not authenticated, proceeding with OAuth flow without existing user assignment');
                }

                const tokenData = await exchangeCodeForToken("facebook", code)
                const userInfo = await fetchUserInfo("facebook", tokenData.access_token)
                const { userId, loginId } = await createOrUpdateUserWithOauth({
                    name: userInfo.name,
                    email: userInfo.email,
                    providerUserId: userInfo.id,
                    provider: "facebook",
                }, currentUserId);

                const token = await createJwt(userId);
                await Promise.all([
                    setCookie(context, token),
                    loginSuccessful(loginId)
                ]);

                return context.redirect(`https://vrt.gredice.com/prijava/facebook-prijava/povratak?session=${token}`)
            } catch (error) {
                console.error("Facebook OAuth error:", error)
                return context.redirect("https://vrt.gredice.com/prijava/facebook-prijava/povratak?error=oauth_error")
            }
        })
    .post(
        '/change-password',
        describeRoute({
            description: 'Change password using token from email',
        }),
        zValidator(
            "json",
            z.object({
                password: z.string(),
                token: z.string(),
            })
        ),
        async (context) => {
            const { password, token } = context.req.valid('json');

            // Read email from JWT token and verify it
            const { result, error } = await verifyJwt(token, {
                expiry: '1h'
            });
            const emailOrUserId = result?.payload.sub;
            if (!emailOrUserId) {
                console.warn('Token is invalid', error);
                return context.json({
                    error: 'Token is invalid'
                }, { status: 400 });
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
                    return context.json({
                        error: 'User not found'
                    }, { status: 404 });
                }
            }

            // Set email as verified
            const userLogin = userWithLogins.usersLogins.find(login => login.loginId === emailOrUserId && login.loginType === 'password');
            if (!userLogin) {
                console.debug('User password login not found', emailOrUserId, 'creating password login...');
                await createUserPasswordLogin(userWithLogins.id, emailOrUserId, password);
            } else {
                console.debug('User password login found', emailOrUserId, 'updating password...');
                await changePassword(userLogin.id, password);
            }

            return context.json({
                message: 'Password changed successfully'
            });
        })
    .post(
        '/logout',
        describeRoute({
            description: 'Logout user by clearing the session cookie',
        }),
        async (context) => {
            await clearCookie(context);
            return context.json({
                message: 'Logged out successfully'
            });
        })
    .post(
        '/register',
        describeRoute({
            description: 'Register a new user with email and password',
        }),
        zValidator(
            "json",
            z.object({
                email: z.string(),
                password: z.string(),
            })
        ),
        async (context) => {
            const { email, password } = context.req.valid('json');
            const user = await getUserWithLogins(email);
            if (user) {
                console.debug('User already exists', email);
                // TODO: Instead, do login flow (redirect to login url)
                return context.json({
                    error: 'User already exists'
                }, { status: 400 });
            }

            // Create user with password
            await createUserWithPassword(email, password);

            await sendEmailVerification(email);

            return context.json({
                message: 'User created successfully'
            }, { status: 201 });
        })
    .post(
        '/send-change-password-email',
        describeRoute({
            description: 'Send change password email to user',
        }),
        zValidator(
            "json",
            z.object({
                email: z.string(),
            })
        ),
        async (context) => {
            const { email } = context.req.valid('json');
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User does not exist', email);
                return context.json({
                    error: 'User not found'
                }, { status: 404 });
            }

            // Send email
            await sendChangePassword(email);

            return context.json({
                message: 'Change password email sent successfully'
            });
        })
    .post(
        '/send-verify-email',
        describeRoute({
            description: 'Send email verification to user',
        }),
        zValidator(
            "json",
            z.object({
                email: z.string(),
            })
        ),
        async (context) => {
            const { email } = context.req.valid('json');
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User does not exist', email);
                return context.json({
                    error: 'User not found'
                }, { status: 404 });
            }

            // Send email
            await sendEmailVerification(email);

            return context.json({
                message: 'Verify email sent successfully'
            });
        })
    .post(
        '/verify-email',
        describeRoute({
            description: 'Verify user email using token from email',
        }),
        zValidator(
            "json",
            z.object({
                token: z.string(),
            })
        ),
        async (context) => {
            const { token } = context.req.valid('json');

            // Read email from JWT token and verify it
            const { result, error } = await verifyJwt(token, {
                expiry: '1h'
            });
            const email = result?.payload.sub;
            if (!email) {
                console.warn('Token is invalid', error);
                return context.json({
                    error: 'Token is invalid'
                }, { status: 400 });
            }

            // Get user with logins
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User does not exist', email);
                return context.json({
                    error: 'Token is invalid'
                }, { status: 400 });
            }

            // Set email as verified (idempotent)
            const userLogin = user.usersLogins.find(login => login.loginId === email && login.loginType === 'password');
            if (!userLogin) {
                console.debug('User login not found', email);
                return context.json({
                    error: 'Token is invalid'
                }, { status: 400 });
            }
            const loginData = JSON.parse(userLogin.loginData);

            // Helper to log in and respond
            async function loginAndRespond(alreadyVerified: boolean = false) {
                if (!user || !userLogin) {
                    console.debug('User or user login not found', email);
                    throw new Error('User or user login not found');
                }

                const jwtToken = await createJwt(user.id);
                await Promise.all([
                    setCookie(context, jwtToken),
                    loginSuccessful(userLogin.id)
                ]);
                return context.json({
                    token: jwtToken,
                    ...(alreadyVerified ? { alreadyVerified: true } : {})
                });
            }

            if (loginData.isVerified === true) {
                // Already verified
                return await loginAndRespond(true);
            }
            await updateLoginData(userLogin.id, {
                ...loginData,
                isVerified: true
            });

            // Send welcome message
            await sendWelcome(email, {
                email,
                ctaUrl: 'https://vrt.gredice.com'
            });

            return loginAndRespond(false);
        });

export default app;