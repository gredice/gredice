import { SignJWT } from 'jose';
import { jwtSecretFactory } from '../../lib/auth/auth';
import { sendEmailVerify } from '../email/transactional';

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