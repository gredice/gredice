'use server';

import { sendEmail } from '@gredice/email/acs';
import {
    getNewsletterAudience,
    type NewsletterAudienceSummary,
} from '@gredice/storage';
import NewsletterEmailTemplate from '@gredice/transactional/emails/Newsletter/newsletter';

export interface NewsletterSendPayload {
    subject: string;
    header?: string | null;
    previewText?: string | null;
    content: string;
}

export interface NewsletterSendResult {
    success: boolean;
    sent: number;
    failed: number;
    summary: NewsletterAudienceSummary;
    message: string;
    errors?: { email: string; message: string }[];
}

export async function sendNewsletter({
    subject,
    header,
    previewText,
    content,
}: NewsletterSendPayload): Promise<NewsletterSendResult> {
    const audience = await getNewsletterAudience();

    if (audience.total === 0) {
        const summary: NewsletterAudienceSummary = {
            total: audience.total,
            subscriberCount: audience.subscriberCount,
            optedInUserCount: audience.optedInUserCount,
            duplicateCount: audience.duplicateCount,
        };

        return {
            success: false,
            sent: 0,
            failed: 0,
            summary,
            message:
                'Trenutno nema pretplatnika kojima bi se mogao poslati newsletter.',
        };
    }

    const resolvedHeader =
        header && header.length > 0 ? header : 'Gredice Newsletter';
    const resolvedPreviewText =
        previewText && previewText.length > 0 ? previewText : subject;

    let sent = 0;
    const errors: { email: string; message: string }[] = [];

    for (const recipient of audience.recipients) {
        try {
            await sendEmail({
                from: 'suncokret@obavijesti.gredice.com',
                to: recipient.email,
                subject,
                template: NewsletterEmailTemplate({
                    header: resolvedHeader,
                    content,
                    previewText: resolvedPreviewText,
                }),
            });
            sent += 1;
        } catch (error) {
            console.error('Failed to send newsletter', recipient.email, error);
            errors.push({
                email: recipient.email,
                message:
                    error instanceof Error
                        ? error.message
                        : 'Nepoznata pogreška pri slanju.',
            });
        }
    }

    const summary: NewsletterAudienceSummary = {
        total: audience.total,
        subscriberCount: audience.subscriberCount,
        optedInUserCount: audience.optedInUserCount,
        duplicateCount: audience.duplicateCount,
    };

    return {
        success: errors.length === 0,
        sent,
        failed: errors.length,
        summary,
        message:
            errors.length === 0
                ? 'Newsletter je uspješno poslan svim primateljima.'
                : 'Newsletter je poslan, ali neki primatelji nisu uspješno zaprimili poruku.',
        errors: errors.length ? errors : undefined,
    };
}
