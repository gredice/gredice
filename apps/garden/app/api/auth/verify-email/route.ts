import { jwtVerify } from 'jose';
import { jwtSecretFactory } from '../../../../lib/auth/auth';
import { getUserWithLogins, updateLoginData } from '@gredice/storage';
import { sendWelcome } from '../../../../lib/email/transactional';

export async function POST(request: Request) {
    const body = await request.json();
    const { token } = body;
    if (!token) {
        return new Response('Token is required', { status: 400 });
    }

    // Read email from JWT token and verify it
    const data = await jwtVerify(token, jwtSecretFactory());
    const email = data.payload.sub;
    if (!email) {
        return new Response('Token is invalid', { status: 400 });
    }

    // Get user with logins
    const user = await getUserWithLogins(email);
    if (!user) {
        console.log('User does not exist', email);
        return new Response('User does not exist', { status: 400 });
    }

    // Set email as verified
    const userLogin = user.usersLogins.find(login => login.loginId === email && login.loginType === 'password');
    if (!userLogin) {
        console.log('User login not found', email);
        return new Response('User name and password incorrect', { status: 404 });
    }
    await updateLoginData(userLogin.id, {
        ...JSON.parse(userLogin.loginData),
        isVerified: true
    });

    // Send welcome message
    await sendWelcome(email, {
        email,
        ctaUrl: 'https://vrt.gredice.com'
    })

    return new Response(null, { status: 204 });
}