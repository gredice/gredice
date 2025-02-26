import { createJwt } from './auth';
import { sendEmailVerify, sendResetPassword } from '../email/transactional';

// TODO: Move to Auth lib
export async function sendEmailVerification(email: string) {
    const jwt = await createJwt(email, '1h');
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

// TODO: Move to Auth lib
export async function sendChangePassword(email: string) {
    const jwt = await createJwt(email, '1h');
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