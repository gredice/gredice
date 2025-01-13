import { getUserWithLogins } from "@gredice/storage";
import { SignJWT } from "jose";
import { jwtSecretFactory } from "../../../../lib/auth/auth";
import { sendResetPassword } from "../../../../lib/email/transactional";

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

export async function POST(request: Request) {
    const { email } = await request.json();
    if (!email) {
        return new Response('Email is required', { status: 400 });
    }

    const user = await getUserWithLogins(email);
    if (!user) {
        return new Response('User not found', { status: 404 });
    }

    await sendChangePassword(email);

    return new Response('Email sent', { status: 201 });
}