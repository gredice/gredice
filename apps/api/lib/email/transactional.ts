import { sendEmail } from '@gredice/email/acs';
import EmailVerifyEmailTemplate, {
    type EmailVerifyEmailTemplateProps,
} from '@gredice/transactional/emails/Account/email-verify';
import ResetPasswordEmailTemplate, {
    type ResetPasswordEmailTemplateProps,
} from '@gredice/transactional/emails/Account/reset-password';
import WelcomeEmailTemplate, {
    type WelcomeEmailTemplateProps,
} from '@gredice/transactional/emails/Account/welcome';
import DeliveryReadyEmailTemplate, {
    type DeliveryReadyEmailTemplateProps,
} from '@gredice/transactional/emails/Notifications/delivery-ready';
import DeliveryScheduledEmailTemplate, {
    type DeliveryScheduledEmailTemplateProps,
} from '@gredice/transactional/emails/Notifications/delivery-scheduled';
import DeliverySurveyEmailTemplate, {
    type DeliverySurveyEmailTemplateProps,
} from '@gredice/transactional/emails/Notifications/delivery-survey';
import EmailNotificationsBulkTemplate, {
    type EmailNotificationsBulkTemplateProps,
} from '@gredice/transactional/emails/Notifications/notifications-bulk';

export async function sendEmailVerify(
    to: string,
    config: EmailVerifyEmailTemplateProps,
) {
    return await sendEmail({
        from: 'suncokret@obavijesti.gredice.com',
        to,
        subject: 'Gredice - potvrda email adrese',
        template: EmailVerifyEmailTemplate(config),
    });
}

export async function sendResetPassword(
    to: string,
    config: ResetPasswordEmailTemplateProps,
) {
    return await sendEmail({
        from: 'suncokret@obavijesti.gredice.com',
        to,
        subject: 'Gredice - promjena zaporke',
        template: ResetPasswordEmailTemplate(config),
    });
}

export async function sendWelcome(
    to: string,
    config: WelcomeEmailTemplateProps,
) {
    return await sendEmail({
        from: 'suncokret@obavijesti.gredice.com',
        to,
        subject: 'Dobrodošli u Gredice',
        template: WelcomeEmailTemplate(config),
    });
}

export async function sendDeliveryScheduled(
    to: string,
    config: DeliveryScheduledEmailTemplateProps,
) {
    const templateProps = {
        ...config,
        email: config.email ?? to,
    } satisfies DeliveryScheduledEmailTemplateProps;

    return await sendEmail({
        from: 'suncokret@obavijesti.gredice.com',
        to,
        subject: 'Gredice - termin tvoje dostave',
        template: DeliveryScheduledEmailTemplate(templateProps),
    });
}

export async function sendDeliveryReady(
    to: string,
    config: DeliveryReadyEmailTemplateProps,
) {
    const templateProps = {
        ...config,
        email: config.email ?? to,
    } satisfies DeliveryReadyEmailTemplateProps;

    return await sendEmail({
        from: 'suncokret@obavijesti.gredice.com',
        to,
        subject: 'Gredice - dostava je spremna',
        template: DeliveryReadyEmailTemplate(templateProps),
    });
}

export async function sendNotificationsBulk(
    to: string,
    config: EmailNotificationsBulkTemplateProps,
) {
    return await sendEmail({
        from: 'suncokret@obavijesti.gredice.com',
        to,
        subject: 'Gredice - nove obavijesti',
        template: EmailNotificationsBulkTemplate(config),
    });
}

export async function sendDeliverySurvey(
    to: string,
    config: DeliverySurveyEmailTemplateProps,
) {
    return await sendEmail({
        from: 'suncokret@obavijesti.gredice.com',
        to,
        subject: 'Gredice - podijeli dojam o dostavi',
        template: DeliverySurveyEmailTemplate(config),
    });
}
