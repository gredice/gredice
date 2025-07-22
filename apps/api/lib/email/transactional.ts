import { sendEmail } from '@gredice/email/acs';
import ResetPasswordEmailTemplate from '@gredice/transactional/emails/Account/reset-password';
import { ResetPasswordEmailTemplateProps } from '@gredice/transactional/emails/Account/reset-password';
import WelcomeEmailTemplate from '@gredice/transactional/emails/Account/welcome';
import { WelcomeEmailTemplateProps } from '@gredice/transactional/emails/Account/welcome';
import EmailNotificationsBulkTemplate from '@gredice/transactional/emails/Notifications/notifications-bulk';
import { EmailNotificationsBulkTemplateProps } from '@gredice/transactional/emails/Notifications/notifications-bulk';
import EmailVerifyEmailTemplate from '@gredice/transactional/emails/Account/email-verify';
import { EmailVerifyEmailTemplateProps } from '@gredice/transactional/emails/Account/email-verify';
;

export async function sendEmailVerify(to: string, config: EmailVerifyEmailTemplateProps) {
    return await sendEmail({
        from: 'Gredice <suncokret@obavijesti.gredice.com>',
        to,
        subject: 'Gredice - potvrda email adrese',
        template: EmailVerifyEmailTemplate(config),
    });
}

export async function sendResetPassword(to: string, config: ResetPasswordEmailTemplateProps) {
    return await sendEmail({
        from: 'Gredice <suncokret@obavijesti.gredice.com>',
        to,
        subject: 'Gredice - promjena zaporke',
        template: ResetPasswordEmailTemplate(config),
    });
}

export async function sendWelcome(to: string, config: WelcomeEmailTemplateProps) {
    return await sendEmail({
        from: 'Gredice <suncokret@obavijesti.gredice.com>',
        to,
        subject: 'Dobrodošli u Gredice',
        template: WelcomeEmailTemplate(config),
    });
}

export async function sendNotificationsBulk(to: string, config: EmailNotificationsBulkTemplateProps) {
    return await sendEmail({
        from: 'Gredice <suncokret@obavijesti.gredice.com>',
        to,
        subject: 'Gredice - nove obavijesti',
        template: EmailNotificationsBulkTemplate(config),
    });
}