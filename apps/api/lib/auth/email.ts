import { sendEmailVerify, sendResetPassword } from '../email/transactional';
import { createJwt } from './auth';

// TODO: Move to Auth lib
export async function sendEmailVerification(email: string) {
    const jwt = await createJwt(email, '1h');
    const url = `https://vrt.gredice.com/prijava/potvrda-emaila?token=${jwt}`;

    await sendEmailVerify(email, {
        email,
        confirmLink: url,
    });
}

// TODO: Move to Auth lib
export async function sendChangePassword(email: string) {
    const jwt = await createJwt(email, '1h');
    const url = `https://vrt.gredice.com/prijava/promjena-zaporke?token=${jwt}`;

    await sendResetPassword(email, {
        email,
        confirmLink: url,
    });
}
