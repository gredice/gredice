import { Resend } from 'resend';
import ResetPasswordEmailTemplate from '@gredice/transactional/emails/reset-password';
import { ResetPasswordEmailTemplateProps } from '@gredice/transactional/emails/reset-password';
import WelcomeEmailTemplate from '@gredice/transactional/emails/welcome';
import { WelcomeEmailTemplateProps } from '@gredice/transactional/emails/welcome';
import EmailVerifyEmailTemplate from '@gredice/transactional/emails/email-verify';
import { EmailVerifyEmailTemplateProps } from '@gredice/transactional/emails/email-verify';

let resend: Resend | null = null;

function getResend() {
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
}

export async function sendEmailVerify(to: string, config: EmailVerifyEmailTemplateProps) {
    return await getResend().emails.send({
        from: 'Gredice <suncokret@obavijesti.gredice.com>',
        to: [to],
        subject: 'Gredice - potvrda email adrese',
        react: EmailVerifyEmailTemplate(config),
    });
}

export async function sendResetPassword(to: string, config: ResetPasswordEmailTemplateProps) {
    return await getResend().emails.send({
        from: 'Gredice <suncokret@obavijesti.gredice.com>',
        to: [to],
        subject: 'Dobrodošli u Gredice',
        react: ResetPasswordEmailTemplate(config),
    });
}

export async function sendWelcome(to: string, config: WelcomeEmailTemplateProps) {
    return await getResend().emails.send({
        from: 'Gredice <suncokret@obavijesti.gredice.com>',
        to: [to],
        subject: 'Dobrodošli u Gredice',
        react: WelcomeEmailTemplate(config),
    });
}