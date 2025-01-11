import { blockLogin, clearLoginFailedAttempts, getUserWithLogins, incLoginFailedAttempts } from "@gredice/storage";
import { pbkdf2Sync } from 'crypto';
import { createJwt, setCookie } from "../../../lib/auth/auth";

// TODO: Move to Auth configuration
const failedAttemptClearTime = 1000 * 60; // 1 minute
const failedAttemptsBlock = 5;
const failedAttemptsBlockTime = 1000 * 60 * 60; // 1 hour

export async function POST(request: Request) {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
        return new Response('User name and password are required', { status: 400 });
    }

    const user = await getUserWithLogins(email);
    if (!user) {
        console.debug('User not found', email);
        return new Response('User name and password incorrect', { status: 404 });
    }

    const login = user.usersLogins.find(login => login.loginType === 'password');
    if (!login) {
        console.debug('User login not found', email);
        return new Response('User name and password incorrect', { status: 404 });
    }

    // TODO: Move to Auth library
    // Check if user is blocked
    if (login.blockedUntil && login.blockedUntil.getTime() > Date.now()) {
        console.debug('User blocked', email);
        return new Response('User name and password incorrect', { status: 404 });
    }

    // Extract salt and password hash from login
    const { salt, password: storedHash } = JSON.parse(login.loginData);
    if (!salt || !storedHash) {
        console.debug('User password login data corrupted', email, login.id);
        return new Response('User name and password incorrect', { status: 404 });
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

        return new Response('User name and password incorrect', { status: 404 });
    }

    // TODO: Move to Auth library
    // Clear failed attempts on successful login
    if (login.failedAttempts > 0) {
        await clearLoginFailedAttempts(login.id);
    }

    await setCookie(createJwt(user.id));

    return new Response(null, { status: 204 });
}