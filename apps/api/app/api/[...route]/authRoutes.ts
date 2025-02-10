import { Hono } from 'hono';
import { validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";
import { blockLogin, changePassword, clearLoginFailedAttempts, createUserWithPassword, getUserWithLogins, incLoginFailedAttempts, updateLoginData } from '@gredice/storage';
import { pbkdf2Sync } from 'node:crypto';
import { clearCookie, createJwt, jwtSecretFactory, setCookie } from '../../../lib/auth/auth';
import { jwtVerify, SignJWT } from 'jose';
import { sendEmailVerification } from '../../../lib/auth/email';
import { sendResetPassword, sendWelcome } from '../../../lib/email/transactional';

const failedAttemptClearTime = 1000 * 60; // 1 minute
const failedAttemptsBlock = 5;
const failedAttemptsBlockTime = 1000 * 60 * 60; // 1 hour

// TODO: Move to lib
async function sendChangePassword(email: string) {
    const jwt = await new SignJWT()
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(email)
        .setExpirationTime('1h')
        .sign(jwtSecretFactory());
    const url = `https://vrt.gredice.com/prijava/promjena-zaporke?token=${jwt}`;

    const { error } = await sendResetPassword(email, {
        email,
        confirmLink: url
    });
    if (error) {
        console.error('Failed to send email', error);
        throw new Error('Failed to send email');
    }
}

const app = new Hono()
    .post(
        '/login',
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
                return context.notFound();
            }

            const login = user.usersLogins.find(login => login.loginType === 'password');
            if (!login) {
                console.debug('User login not found', email);
                return context.notFound();
            }

            // TODO: Move to Auth library
            // Check if user is blocked
            if (login.blockedUntil && login.blockedUntil.getTime() > Date.now()) {
                console.debug('User blocked', email);
                return context.notFound();
            }

            // Extract salt and password hash from login
            const { salt, password: storedHash } = JSON.parse(login.loginData);
            if (!salt || !storedHash) {
                console.debug('User password login data corrupted', email, login.id);
                return context.notFound();
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

                return context.notFound();
            }

            // TODO: Move to Auth library
            // Clear failed attempts on successful login
            if (login.failedAttempts > 0) {
                await clearLoginFailedAttempts(login.id);
            }

            // Check email verified
            const { isVerified } = JSON.parse(login.loginData)
            if (isVerified !== true) {
                console.log('User email not verified', email);
                return context.json({
                    error: 'verify_email'
                }, { status: 403 });
            }

            const token = await createJwt(user.id);
            await setCookie(context, token);

            return context.json({
                token
            });
        })
    .post(
        '/change-password',
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
            const data = await jwtVerify(token, jwtSecretFactory());
            const email = data.payload.sub;
            if (!email) {
                return context.newResponse('Token is invalid', { status: 400 });
            }

            // Get user with logins
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User does not exist', email);
                return context.notFound();
            }

            // Set email as verified
            const userLogin = user.usersLogins.find(login => login.loginId === email && login.loginType === 'password');
            if (!userLogin) {
                console.debug('User login not found', email);
                return context.notFound();
            }

            // Send email
            await changePassword(userLogin.id, password);

            return context.newResponse(null, { status: 204 });
        })
    .post(
        '/logout',
        async (context) => {
            await clearCookie(context);
            return context.newResponse(null, { status: 204 });
        })
    .post(
        '/register',
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
                // TODO: Instead, do login flow
                return context.newResponse('User already exists', { status: 400 });
            }

            // Create user with password
            await createUserWithPassword(email, password);

            await sendEmailVerification(email);

            return context.newResponse(null, { status: 201 });
        })
    .post(
        '/send-change-password-email',
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
                return context.notFound();
            }

            // Send email
            await sendChangePassword(email);

            return context.newResponse(null, { status: 201 });
        })
    .post(
        '/send-verify-email',
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
                return context.notFound();
            }

            // Send email
            await sendEmailVerification(email);

            return context.newResponse(null, { status: 201 });
        })
    .post(
        '/verify-email',
        zValidator(
            "json",
            z.object({
                token: z.string(),
            })
        ),
        async (context) => {
            const { token } = context.req.valid('json');

            // Read email from JWT token and verify it
            const data = await jwtVerify(token, jwtSecretFactory());
            const email = data.payload.sub;
            if (!email) {
                return context.newResponse('Token is invalid', { status: 400 });
            }

            // Get user with logins
            const user = await getUserWithLogins(email);
            if (!user) {
                console.debug('User does not exist', email);
                return context.notFound();
            }

            // Set email as verified
            const userLogin = user.usersLogins.find(login => login.loginId === email && login.loginType === 'password');
            if (!userLogin) {
                console.debug('User login not found', email);
                return context.notFound();
            }
            await updateLoginData(userLogin.id, {
                ...JSON.parse(userLogin.loginData),
                isVerified: true
            });

            // Send welcome message
            await sendWelcome(email, {
                email,
                ctaUrl: 'https://vrt.gredice.com'
            });

            return context.newResponse(null, { status: 204 });
        });

export default app;