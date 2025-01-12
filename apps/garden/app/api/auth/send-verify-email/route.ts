import { getUserWithLogins } from "@gredice/storage";
import { SignJWT } from 'jose';
import { jwtSecretFactory } from "../../../../lib/auth/auth";
import { sendEmailVerify } from "../../../../lib/email/transactional";

// TODO: Move to Auth lib
export async function sendEmailVerification(email: string) {
    const jwt = await new SignJWT()
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(email)
        .setExpirationTime('1h')
        .sign(jwtSecretFactory());
    const url = `https://vrt.gredice.com/prijava/potvrda-emaila?token=${jwt}`;

    const { error } = await sendEmailVerify(email, {
        email,
        confirmLink: url,
    });
    if (error) {
        console.error('Failed to send email', error);
        throw new Error('Failed to send email');
    }
}

export async function POST(request: Request) {
    const body = await request.json();
    const { email } = body;
    if (!email) {
        return new Response('Email is required', { status: 400 });
    }

    const user = await getUserWithLogins(email);
    if (!user) {
        console.log('User does not exist', email);
        return new Response('User does not exist', { status: 400 });
    }

    // Send email
    await sendEmailVerification(email);

    return new Response(null, { status: 201 });
}