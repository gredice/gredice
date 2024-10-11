import { getUserWithLogins } from "@gredice/storage";
import { pbkdf2Sync } from 'crypto';
import { createJwt, setCookie } from "../../../lib/auth/auth";

export async function POST(request: Request) {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
        return new Response('User name and password are required', { status: 400 });
    }

    // TODO: Enable to create user
    // const createPasswordSalt = randomBytes(128).toString('base64');
    // const hash = pbkdf2Sync(password, createPasswordSalt, 10000, 512, 'sha512').toString('hex');
    // await createUserWithPassword(email, hash, createPasswordSalt);

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

    // Extract salt and password hash from login
    const { salt, password: storedHash } = JSON.parse(login.loginData);
    const checkHash = pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
    if (checkHash !== storedHash) {
        console.debug('User password not matching', email);
        console.debug('Check hash', salt, checkHash);
        return new Response('User name and password incorrect', { status: 404 });
    }

    await setCookie(createJwt(user.id));

    return new Response(null, { status: 204 });
}