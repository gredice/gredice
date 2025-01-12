import { Resend } from 'resend';
import WelcomeEmailTemplate from '@gredice/transactional/emails/welcome';
import { WelcomeEmailTemplateProps } from '@gredice/transactional/emails/welcome';
import EmailVerifyEmailTemplate from '@gredice/transactional/emails/email-verify';
import { EmailVerifyEmailTemplateProps } from '@gredice/transactional/emails/email-verify';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmailVerify(to: string, config: EmailVerifyEmailTemplateProps) {
    return await resend.emails.send({
        from: 'Gredice <suncokret@obavijesti.gredice.com>',
        to: [to],
        subject: 'Gredice - potvrda email adrese',
        react: EmailVerifyEmailTemplate(config),
    });
}

export async function sendWelcome(to: string, config: WelcomeEmailTemplateProps) {
    return await resend.emails.send({
        from: 'Gredice <suncokret@obavijesti.gredice.com>',
        to: [to],
        subject: 'Dobrodošli u Gredice',
        react: WelcomeEmailTemplate(config),
    });
}