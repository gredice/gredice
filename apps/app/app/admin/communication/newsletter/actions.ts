'use server';

import { randomUUID } from 'node:crypto';

import { getNewsletterAudienceSummary } from '@gredice/storage';
import { revalidatePath } from 'next/cache';
import { auth } from '../../../../lib/auth/auth';
import { uploadToCdn } from '../../../../lib/cdn/uploadToCdn';
import {
    type NewsletterSendResult,
    sendNewsletter,
} from '../../../../lib/newsletter/sendNewsletter';
import { KnownPages } from '../../../../src/KnownPages';

export type NewsletterSendState = NewsletterSendResult;

export async function uploadNewsletterImageAction(formData: FormData) {
    await auth(['admin']);

    const file = formData.get('image');
    if (!file || typeof file === 'string') {
        return { success: false, error: 'Nije odabrana nijedna slika.' };
    }
    if (!file.type?.startsWith('image/')) {
        return { success: false, error: 'Podržane su samo slikovne datoteke.' };
    }

    const originalName = formData.get('fileName')?.toString();
    const extension = (() => {
        if (originalName?.includes('.')) {
            const segment = originalName.substring(
                originalName.lastIndexOf('.') + 1,
            );
            return segment.length > 0 ? segment : null;
        }
        if (file.type?.includes('/')) {
            const segment = file.type.split('/').pop();
            return segment && segment.length > 0 ? segment : null;
        }
        return null;
    })();

    const blobName = `newsletter/${randomUUID()}${extension ? `.${extension}` : ''}`;

    try {
        const { url } = await uploadToCdn({
            key: blobName,
            data: file,
            contentType: file.type,
        });

        return { success: true, url };
    } catch (error) {
        console.error('Newsletter image upload failed', error);
        return {
            success: false,
            error: 'Neuspjelo učitavanje slike. Pokušaj ponovno.',
        };
    }
}

export async function sendNewsletterAction(
    _previousState: NewsletterSendState | null,
    formData: FormData,
): Promise<NewsletterSendState> {
    await auth(['admin']);

    const subject = (formData.get('subject') as string | null)?.trim();
    const header = (formData.get('header') as string | null)?.trim();
    const previewText =
        (formData.get('previewText') as string | null)?.trim() ?? subject ?? '';
    const content = (formData.get('content') as string | null)?.trim();

    if (!subject) {
        const summary = await getNewsletterAudienceSummary();
        return {
            success: false,
            sent: 0,
            failed: 0,
            summary,
            message: 'Naslov je obavezan.',
        };
    }

    if (!content) {
        const summary = await getNewsletterAudienceSummary();
        return {
            success: false,
            sent: 0,
            failed: 0,
            summary,
            message: 'Sadržaj newslettera ne može biti prazan.',
        };
    }

    const result = await sendNewsletter({
        subject,
        header,
        previewText,
        content,
    });

    revalidatePath(KnownPages.CommunicationNewsletter);
    return result;
}
